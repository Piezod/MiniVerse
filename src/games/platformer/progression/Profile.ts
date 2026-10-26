/**
 * Player profile: star wallet, purchased abilities and equipment (Phaser-free, persisted).
 * Each star counts once ever (by level + tile), so replaying a level never duplicates currency;
 * the spendable balance is `earned - spent`.
 */
import type { AbilityCatalog, AbilityDef } from '../abilities/AbilityCatalog';
import type { ProgressStorage } from '../level/LevelManager';

export const MAX_ACTIVE_ABILITIES = 2;

interface ProfileData {
  version: 1;
  /** Star tile keys ("col,row") collected at least once per level. */
  collected: Record<string, string[]>;
  spent: number;
  /** Owned level per ability (missing = not owned). */
  owned: Record<string, number>;
  equipped: string[];
}

export type PurchaseCheck =
  | { ok: true; cost: number; nextLevel: number }
  | { ok: false; reason: 'unknown' | 'maxed' | 'locked' | 'funds'; cost?: number };

const empty = (): ProfileData => ({ version: 1, collected: {}, spent: 0, owned: {}, equipped: [] });

export class Profile {
  private data: ProfileData;

  constructor(
    private readonly catalog: AbilityCatalog,
    private readonly storage: ProgressStorage,
  ) {
    this.data = this.sanitize(storage.load());
  }

  get earned(): number {
    return Object.values(this.data.collected).reduce((sum, stars) => sum + stars.length, 0);
  }

  get balance(): number {
    return this.earned - this.data.spent;
  }

  get equipped(): readonly string[] {
    return this.data.equipped;
  }

  /** Equipped active abilities in slot order (slot 1, slot 2). */
  get activeSlots(): string[] {
    return this.data.equipped.filter((id) => this.catalog.abilities[id]?.slot === 'active');
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
    return this.data.owned[abilityId] ?? 0;
  }

  canPurchase(abilityId: string, isLevelCompleted: (levelId: string) => boolean): PurchaseCheck {
    const def = this.catalog.abilities[abilityId];
    if (!def) return { ok: false, reason: 'unknown' };
    const current = this.levelOf(abilityId);
    if (current >= def.levels.length) return { ok: false, reason: 'maxed' };
    const cost = def.levels[current].cost;
    if (def.requires && !isLevelCompleted(def.requires)) return { ok: false, reason: 'locked', cost };
    if (this.balance < cost) return { ok: false, reason: 'funds', cost };
    return { ok: true, cost, nextLevel: current + 1 };
  }

  /** Buys the next level of an ability. New abilities are equipped automatically when a slot is free. */
  purchase(abilityId: string, isLevelCompleted: (levelId: string) => boolean): PurchaseCheck {
    const check = this.canPurchase(abilityId, isLevelCompleted);
    if (!check.ok) return check;
    this.data.spent += check.cost;
    this.data.owned[abilityId] = check.nextLevel;
    if (check.nextLevel === 1) this.equip(abilityId);
    this.save();
    return check;
  }

  isEquipped(abilityId: string): boolean {
    return this.data.equipped.includes(abilityId);
  }

  /** Equips an owned ability. Returns false if not owned or every active slot is taken. */
  equip(abilityId: string): boolean {
    const def = this.catalog.abilities[abilityId];
    if (!def || this.levelOf(abilityId) === 0) return false;
    if (this.isEquipped(abilityId)) return true;
    if (def.slot === 'active' && this.activeSlots.length >= MAX_ACTIVE_ABILITIES) return false;
    this.data.equipped.push(abilityId);
    this.save();
    return true;
  }

  unequip(abilityId: string): void {
    this.data.equipped = this.data.equipped.filter((id) => id !== abilityId);
    this.save();
  }

  /** Equipped abilities with their owned level, ready to instantiate. */
  loadout(): Array<{ def: AbilityDef; level: number }> {
    return this.data.equipped
      .map((id) => ({ def: this.catalog.abilities[id], level: this.levelOf(id) }))
      .filter((entry): entry is { def: AbilityDef; level: number } => !!entry.def && entry.level > 0);
  }

  private save(): void {
    this.storage.save(JSON.stringify(this.data));
  }

  /** Never trusts stored data: drops unknown ids, clamps levels and prevents negative balances. */
  private sanitize(stored: string | null): ProfileData {
    let parsed: Partial<ProfileData> | null = null;
    try {
      parsed = JSON.parse(stored ?? 'null') as Partial<ProfileData> | null;
    } catch {
      parsed = null;
    }
    const data = empty();
    if (!parsed || typeof parsed !== 'object') return data;
    if (parsed.collected && typeof parsed.collected === 'object') {
      for (const [level, keys] of Object.entries(parsed.collected)) {
        if (Array.isArray(keys)) data.collected[level] = [...new Set(keys.filter((k): k is string => typeof k === 'string'))];
      }
    }
    if (parsed.owned && typeof parsed.owned === 'object') {
      for (const [id, level] of Object.entries(parsed.owned)) {
        const def = this.catalog.abilities[id];
        if (def && typeof level === 'number' && level > 0) data.owned[id] = Math.min(def.levels.length, Math.floor(level));
      }
    }
    const spent = typeof parsed.spent === 'number' && parsed.spent > 0 ? Math.floor(parsed.spent) : 0;
    data.spent = Math.min(spent, this.earnedOf(data));
    if (Array.isArray(parsed.equipped)) {
      let actives = 0;
      for (const id of parsed.equipped) {
        const def = typeof id === 'string' ? this.catalog.abilities[id] : undefined;
        if (!def || !data.owned[id] || data.equipped.includes(id)) continue;
        if (def.slot === 'active' && ++actives > MAX_ACTIVE_ABILITIES) continue;
        data.equipped.push(id);
      }
    }
    return data;
  }

  private earnedOf(data: ProfileData): number {
    return Object.values(data.collected).reduce((sum, stars) => sum + stars.length, 0);
  }
}
