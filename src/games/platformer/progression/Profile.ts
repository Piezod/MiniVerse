/**
 * Player profile: star wallet, purchased abilities and equipment (Phaser-free, persisted).
 * Each star counts once ever (by level + tile), so replaying a level never duplicates currency;
 * the spendable balance is `earned - spent`.
 *
 * Save format history (see migrateProfile):
 *   v1: { collected, spent, owned, equipped: string[] }    weapons bound to a fixed button
 *   v2: { collected, spent, owned, passives: string[], weapons: { primary, secondary } }
 */
import type { AbilityCatalog, AbilityDef } from '../abilities/AbilityCatalog';
import { ABILITY_BUTTONS, type AbilityButton } from '../controls';
import type { ProgressStorage } from '../level/LevelManager';
import { STANDARD_ACCESS, type AccessPolicy } from './accessPolicy';

export const PROFILE_VERSION = 2;
/** Weapon slots: F (primary) and R (secondary). */
export const MAX_ACTIVE_ABILITIES = ABILITY_BUTTONS.length;

export type WeaponSlots = Record<AbilityButton, string | null>;

export interface ProfileData {
  version: 2;
  /** Star tile keys ("col,row") collected at least once per level. */
  collected: Record<string, string[]>;
  spent: number;
  /** Owned level per ability (missing = not owned). */
  owned: Record<string, number>;
  /** Equipped passive abilities (Propulsión...). */
  passives: string[];
  /** Weapon equipped on each button. */
  weapons: WeaponSlots;
}

export type PurchaseCheck =
  | { ok: true; cost: number; nextLevel: number }
  | { ok: false; reason: 'unknown' | 'unavailable' | 'maxed' | 'locked' | 'funds'; cost?: number };

export interface LoadoutEntry {
  def: AbilityDef;
  level: number;
  /** Button that fires this weapon (null for passives). */
  button: AbilityButton | null;
}

const emptySlots = (): WeaponSlots => Object.fromEntries(ABILITY_BUTTONS.map((b) => [b, null])) as WeaponSlots;
const empty = (): ProfileData => ({ version: 2, collected: {}, spent: 0, owned: {}, passives: [], weapons: emptySlots() });
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Ability ids that used to live in the v1 "equipped" list, mapped to their v1 fixed button. */
const V1_BUTTONS: Record<string, AbilityButton> = { beam: 'primary', flamethrower: 'secondary' };

/**
 * Converts any stored profile to the current version (pure; the result is still sanitized by
 * Profile). v1 kept every equipped id in one list and each weapon had a fixed button; those ids
 * are split into passives and weapon slots, keeping stars, purchases and upgrades untouched.
 */
export function migrateProfile(stored: unknown, catalog: AbilityCatalog): Record<string, unknown> | null {
  if (!isRecord(stored)) return null;
  const version = typeof stored.version === 'number' ? stored.version : 1;
  if (version >= PROFILE_VERSION) return stored;
  const passives: string[] = [];
  const weapons = emptySlots();
  for (const id of Array.isArray(stored.equipped) ? stored.equipped : []) {
    if (typeof id !== 'string') continue;
    const def = catalog.abilities[id];
    if (def?.slot === 'passive') passives.push(id);
    else if (def) {
      const button = def.defaultSlot ?? V1_BUTTONS[id] ?? ABILITY_BUTTONS.find((b) => weapons[b] === null);
      if (button && weapons[button] === null) weapons[button] = id;
    }
  }
  const { equipped: _legacy, ...rest } = stored;
  return { ...rest, version: PROFILE_VERSION, passives, weapons };
}

export class Profile {
  private data: ProfileData;

  constructor(
    private readonly catalog: AbilityCatalog,
    private readonly storage: ProgressStorage,
    private readonly access: AccessPolicy = STANDARD_ACCESS,
  ) {
    const stored = storage.load();
    this.data = this.sanitize(stored);
    if (stored === null && access.freeWeapons) {
      for (const def of Object.values(catalog.abilities)) {
        if (def.available && def.slot === 'active' && def.defaultSlot && this.data.weapons[def.defaultSlot] === null) {
          this.data.weapons[def.defaultSlot] = def.id;
        }
      }
      this.save();
    }
    // Persist migrated saves immediately so the old format is never read again.
    if (stored !== null && this.storedVersion(stored) < PROFILE_VERSION) this.save();
  }

  get earned(): number {
    return Object.values(this.data.collected).reduce((sum, stars) => sum + stars.length, 0);
  }

  get balance(): number {
    return this.earned - this.data.spent;
  }

  /** All equipped ids: passives first, then weapons in button order. */
  get equipped(): readonly string[] {
    return [...this.data.passives, ...this.activeSlots];
  }

  /** Equipped weapons in button order (primary = F, secondary = R). */
  get activeSlots(): string[] {
    return ABILITY_BUTTONS.map((button) => this.data.weapons[button]).filter((id): id is string => id !== null);
  }

  /** Weapon equipped on a button, if any. */
  equippedOn(button: AbilityButton): string | undefined {
    return this.data.weapons[button] ?? undefined;
  }

  /** Button a weapon is equipped on, if any. */
  slotOf(abilityId: string): AbilityButton | undefined {
    return ABILITY_BUTTONS.find((button) => this.data.weapons[button] === abilityId);
  }

  collectedIn(levelId: string): number {
    return this.data.collected[levelId]?.length ?? 0;
  }

  /** Adds stars collected in a run; returns how many were new (and therefore spendable). */
  recordStars(levelId: string, starKeys: readonly string[]): number {
    const known = new Set(this.data.collected[levelId] ?? []);
    const before = known.size;
    for (const key of starKeys) known.add(key);
    this.data.collected[levelId] = [...known];
    this.save();
    return known.size - before;
  }

  levelOf(abilityId: string): number {
    const def = this.catalog.abilities[abilityId];
    const base = this.access.freeWeapons && def?.available && def.slot === 'active' ? 1 : 0;
    return Math.max(this.data.owned[abilityId] ?? 0, base);
  }

  canPurchase(abilityId: string, isLevelCompleted: (levelId: string) => boolean): PurchaseCheck {
    const def = this.catalog.abilities[abilityId];
    if (!def) return { ok: false, reason: 'unknown' };
    if (!def.available) return { ok: false, reason: 'unavailable' };
    const current = this.levelOf(abilityId);
    if (current >= def.levels.length) return { ok: false, reason: 'maxed' };
    const cost = def.levels[current].cost;
    if (def.requires && !(this.access.freeWeapons && def.slot === 'active') && !isLevelCompleted(def.requires)) return { ok: false, reason: 'locked', cost };
    if (this.balance < cost) return { ok: false, reason: 'funds', cost };
    return { ok: true, cost, nextLevel: current + 1 };
  }

  /** Buys the next level. New passives are equipped; new weapons take a free slot (preferring their default). */
  purchase(abilityId: string, isLevelCompleted: (levelId: string) => boolean): PurchaseCheck {
    const check = this.canPurchase(abilityId, isLevelCompleted);
    if (!check.ok) return check;
    this.data.spent += check.cost;
    this.data.owned[abilityId] = check.nextLevel;
    if (check.nextLevel === 1) {
      const def = this.catalog.abilities[abilityId];
      if (def.slot === 'passive') this.equip(abilityId);
      else {
        const free = [def.defaultSlot, ...ABILITY_BUTTONS].find((b): b is AbilityButton => !!b && this.data.weapons[b] === null);
        if (free) this.equipWeapon(abilityId, free);
      }
    }
    this.save();
    return check;
  }

  isEquipped(abilityId: string): boolean {
    return this.data.passives.includes(abilityId) || this.slotOf(abilityId) !== undefined;
  }

  /**
   * Equips an owned ability: passives are switched on; weapons go to their default slot or the
   * first free one. Returns false when not owned, unavailable or every weapon slot is taken.
   */
  equip(abilityId: string): boolean {
    const def = this.equippable(abilityId);
    if (!def) return false;
    if (this.isEquipped(abilityId)) return true;
    if (def.slot === 'passive') {
      this.data.passives.push(abilityId);
      this.save();
      return true;
    }
    const free = [def.defaultSlot, ...ABILITY_BUTTONS].find((b): b is AbilityButton => !!b && this.data.weapons[b] === null);
    return free ? this.equipWeapon(abilityId, free) : false;
  }

  /**
   * Puts a weapon on F (primary) or R (secondary). If it was on the other slot, the two slots swap;
   * whatever was on the target slot moves to the weapon's previous slot (or is unequipped).
   */
  equipWeapon(abilityId: string, button: AbilityButton): boolean {
    const def = this.equippable(abilityId);
    if (!def || def.slot !== 'active') return false;
    const previous = this.slotOf(abilityId);
    if (previous === button) return true;
    const displaced = this.data.weapons[button];
    this.data.weapons[button] = abilityId;
    if (previous) this.data.weapons[previous] = displaced;
    this.save();
    return true;
  }

  unequipWeapon(button: AbilityButton): void {
    this.data.weapons[button] = null;
    this.save();
  }

  unequip(abilityId: string): void {
    this.data.passives = this.data.passives.filter((id) => id !== abilityId);
    const slot = this.slotOf(abilityId);
    if (slot) this.data.weapons[slot] = null;
    this.save();
  }

  /** Equipped abilities with their owned level and button, ready to instantiate. */
  loadout(): LoadoutEntry[] {
    const entries: Array<{ id: string; button: AbilityButton | null }> = [
      ...this.data.passives.map((id) => ({ id, button: null })),
      ...ABILITY_BUTTONS.map((button) => ({ id: this.data.weapons[button] ?? '', button })),
    ];
    return entries
      .map(({ id, button }) => ({ def: this.catalog.abilities[id], level: this.levelOf(id), button }))
      .filter((entry): entry is LoadoutEntry => !!entry.def && entry.def.available && entry.level > 0);
  }

  /** Snapshot of the persisted data (for tests and debugging). */
  snapshot(): ProfileData {
    return JSON.parse(JSON.stringify(this.data)) as ProfileData;
  }

  private equippable(abilityId: string): AbilityDef | undefined {
    const def = this.catalog.abilities[abilityId];
    return def && def.available && this.levelOf(abilityId) > 0 ? def : undefined;
  }

  private save(): void {
    this.storage.save(JSON.stringify(this.data));
  }

  private storedVersion(stored: string): number {
    try {
      const parsed = JSON.parse(stored) as unknown;
      return isRecord(parsed) && typeof parsed.version === 'number' ? parsed.version : 1;
    } catch {
      return PROFILE_VERSION;
    }
  }

  /** Never trusts stored data: migrates old versions, drops unknown ids, clamps levels and prevents negative balances. */
  private sanitize(stored: string | null): ProfileData {
    let raw: unknown = null;
    try {
      raw = JSON.parse(stored ?? 'null');
    } catch {
      raw = null;
    }
    const parsed = migrateProfile(raw, this.catalog);
    const data = empty();
    if (!parsed) return data;
    if (isRecord(parsed.collected)) {
      for (const [level, keys] of Object.entries(parsed.collected)) {
        if (Array.isArray(keys)) data.collected[level] = [...new Set(keys.filter((k): k is string => typeof k === 'string'))];
      }
    }
    if (isRecord(parsed.owned)) {
      for (const [id, level] of Object.entries(parsed.owned)) {
        const def = this.catalog.abilities[id];
        if (def && typeof level === 'number' && level > 0) data.owned[id] = Math.min(def.levels.length, Math.floor(level));
      }
    }
    const spent = typeof parsed.spent === 'number' && parsed.spent > 0 ? Math.floor(parsed.spent) : 0;
    data.spent = Math.min(spent, this.earnedOf(data));
    const usable = (id: unknown, slot: AbilityDef['slot']): id is string => {
      const def = typeof id === 'string' ? this.catalog.abilities[id] : undefined;
      return !!def && def.slot === slot && def.available && (!!data.owned[id as string] || (this.access.freeWeapons && slot === 'active'));
    };
    if (Array.isArray(parsed.passives)) data.passives = [...new Set(parsed.passives.filter((id) => usable(id, 'passive')))];
    if (isRecord(parsed.weapons)) {
      for (const button of ABILITY_BUTTONS) {
        const id = parsed.weapons[button];
        if (usable(id, 'active') && !Object.values(data.weapons).includes(id)) data.weapons[button] = id;
      }
    }
    return data;
  }

  private earnedOf(data: ProfileData): number {
    return Object.values(data.collected).reduce((sum, stars) => sum + stars.length, 0);
  }
}
