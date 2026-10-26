import Phaser from 'phaser';
import { playSound } from '../../../core/audio/Sfx';
import { GAME_HEIGHT, GAME_WIDTH } from '../../../core/config';
import { pixelText } from '../../../core/ui/pixelFont';
import { createTextButton } from '../../../core/ui/TextButton';
import type { AbilityDef } from '../abilities/AbilityCatalog';
import { AUDIO, TEX, UI_FRAME } from '../assets/manifest';
import { hex, PALETTE } from '../assets/palette';
import { PlatformerScenes } from '../config';
import { ABILITY_BUTTONS, type AbilityButton, keyLabel } from '../controls';
import { openLevelSelect } from '../level/levelFlow';
import { getLevelManager } from '../level/levelLoader';
import { AFFINITY_KEYS, toAffinity } from '../progression/affinityInfo';
import { getGameData } from '../progression/gameData';
import { weaponSummary } from '../progression/weaponInfo';

const ROW_H = 16;
const LIST_W = 112;
const PANEL_X = LIST_W + 10;
const MUTED = 0x9a86c4;
const MESSAGES = {
  maxed: 'Nivel maximo alcanzado',
  locked: 'Completa el nivel requerido',
  funds: 'No tienes suficientes estrellas',
  unavailable: 'Todavia no disponible',
  unknown: 'Habilidad desconocida',
} as const;

/**
 * Buy/upgrade abilities with stars and choose the equipment: passives on/off and one weapon on
 * each slot (F primary, R secondary). Planned weapons (`available: false`) are not listed.
 */
export class PlatformerShopScene extends Phaser.Scene {
  static readonly KEY = PlatformerScenes.Shop;

  private selected = 0;
  private message = '';
  private rows: Phaser.GameObjects.Rectangle[] = [];
  private list: AbilityDef[] = [];

  constructor() {
    super(PlatformerShopScene.KEY);
  }

  create(data?: { selected?: number; message?: string }): void {
    this.message = data?.message ?? '';
    this.rows = [];
    const { profile, abilities } = getGameData();
    this.list = Object.values(abilities.abilities).filter((def) => def.available);
    this.selected = Phaser.Math.Clamp(data?.selected ?? 0, 0, Math.max(0, this.list.length - 1));
    this.cameras.main.setBackgroundColor('#151634');

    pixelText(this, GAME_WIDTH / 2, 12, 'Tienda', hex(PALETTE.gold), 2).setOrigin(0.5);
    const back = this.add.rectangle(24, 12, 40, 14, 0x141327, 0.6).setStrokeStyle(1, 0xfff8ec, 0.5).setInteractive({ useHandCursor: true });
    pixelText(this, 24, 12, '< NIVELES').setOrigin(0.5);
    back.on('pointerup', () => openLevelSelect(this));
    this.add.image(GAME_WIDTH - 42, 12, TEX.ui, UI_FRAME.star);
    pixelText(this, GAME_WIDTH - 34, 12, String(profile.balance), hex(PALETTE.goldLight)).setOrigin(0, 0.5);

    this.list.forEach((def, i) => this.createRow(def, i, 26 + i * (ROW_H + 2)));
    const slotsY = 26 + this.list.length * (ROW_H + 2) + 8;
    ABILITY_BUTTONS.forEach((button, i) => {
      const id = profile.equippedOn(button);
      const name = id ? abilities.abilities[id]?.name : '-';
      pixelText(this, 8, slotsY + i * 10, `[${keyLabel(button)}] ${name ?? '-'}`, id ? hex(PALETTE.glow) : MUTED);
    });
    createTextButton(this, 8 + 50, GAME_HEIGHT - 24, 'Afinidades', () => this.openAffinities(), 100, 14);

    this.add.rectangle(PANEL_X + (GAME_WIDTH - PANEL_X - 6) / 2, 98, GAME_WIDTH - PANEL_X - 6, 148, 0x2b2552).setStrokeStyle(1, 0x4a3f8a);
    const current = this.list[this.selected];
    if (current) this.createDetail(current);
    pixelText(this, GAME_WIDTH / 2, GAME_HEIGHT - 6, this.message || 'Enter comprar  F/R equipar  E quitar  A afinidades', this.message ? hex(PALETTE.glow) : MUTED).setOrigin(0.5);

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-UP', () => this.select(this.selected - 1));
    keyboard?.on('keydown-DOWN', () => this.select(this.selected + 1));
    keyboard?.on('keydown-ENTER', () => this.buy(this.list[this.selected]));
    for (const button of ABILITY_BUTTONS) keyboard?.on(`keydown-${keyLabel(button)}`, () => this.equipOn(this.list[this.selected], button));
    keyboard?.on('keydown-E', () => this.toggleEquip(this.list[this.selected]));
    keyboard?.on(`keydown-${AFFINITY_KEYS.open}`, () => this.openAffinities());
    keyboard?.on('keydown-ESC', () => openLevelSelect(this));
    this.highlight();
  }

  private createRow(def: AbilityDef, index: number, top: number): void {
    const { profile, chart } = getGameData();
    const owned = profile.levelOf(def.id);
    const y = top + ROW_H / 2;
    const row = this.add.rectangle(LIST_W / 2 + 4, y, LIST_W, ROW_H, 0x2b2552).setStrokeStyle(1, 0x4a3f8a).setInteractive({ useHandCursor: true });
    row.on('pointerup', () => this.select(index));
    this.rows.push(row);
    const element = def.element ? chart.elements[def.element] : undefined;
    if (element) this.add.rectangle(6, y, 2, ROW_H - 4, hex(element.color));
    this.add.image(16, y, TEX.abilityIcons, def.icon);
    pixelText(this, 26, y, def.name, owned ? hex(PALETTE.goldLight) : 0xfff8ec).setOrigin(0, 0.5);
    const slot = profile.slotOf(def.id);
    const tag = slot ? keyLabel(slot) : def.slot === 'passive' && profile.isEquipped(def.id) ? 'ON' : '';
    if (tag) pixelText(this, LIST_W, y, tag, hex(PALETTE.glow)).setOrigin(1, 0.5);
  }

  /** Weapon card: element, matchups, stats, effects, level, price and slot. */
  private createDetail(def: AbilityDef): void {
    const { profile, chart, statuses } = getGameData();
    const manager = getLevelManager();
    const owned = profile.levelOf(def.id);
    const check = profile.canPurchase(def.id, (id) => manager.isCompleted(id));
    const x = PANEL_X + 4;
    let y = 30;

    this.add.image(x + 8, y + 6, TEX.abilityIcons, def.icon).setScale(2);
    pixelText(this, x + 22, y + 2, def.name, hex(PALETTE.goldLight));
    pixelText(this, GAME_WIDTH - 12, y + 2, `NV ${owned}/${def.levels.length}`, owned ? hex(PALETTE.glow) : MUTED).setOrigin(1, 0);
    const element = def.element ? chart.elements[def.element] : undefined;
    pixelText(this, x + 22, y + 11, element ? element.name : 'Pasiva', element ? hex(element.color) : MUTED);
    y += 24;
    pixelText(this, x, y, def.description, MUTED).setMaxWidth(GAME_WIDTH - x - 10);
    y += 14;

    if (element) {
      const names = (ids: string[]): string => ids.map((id) => chart.elements[id]?.name ?? id).join(', ') || '-';
      pixelText(this, x, y, `Fuerte contra: ${names(chart.strongAgainst(element.id))}`, hex(PALETTE.moss));
      pixelText(this, x, y + 9, `Debil contra: ${names(chart.weakAgainst(element.id))}`, hex(PALETTE.heart));
      y += 20;
    }

    // Stats of the owned level, or of level 1 when not bought yet; the next level is shown after ">".
    const levelIndex = Math.max(1, owned);
    const now = weaponSummary(def, levelIndex, statuses.effects);
    const next = owned > 0 && owned < def.levels.length ? weaponSummary(def, owned + 1, statuses.effects) : undefined;
    const line = (label: string, value: string, upgrade?: string): void => {
      pixelText(this, x, y, label, MUTED);
      pixelText(this, x + 48, y, upgrade && upgrade !== value ? `${value} > ${upgrade}` : value);
      y += 9;
    };
    if (def.slot === 'active') {
      line('Dano', now.damage, next?.damage);
      line('Energia', now.energy, next?.energy);
      line('Cooldown', now.cooldown, next?.cooldown);
    }
    line('Efectos', now.effects, next?.effects);
    if (def.slot === 'active') line('Ranura', profile.slotOf(def.id) ? keyLabel(profile.slotOf(def.id)!) : '-');

    if (check.ok === false && check.reason === 'locked' && def.requires) {
      const level = manager.get(def.requires);
      pixelText(this, x, y, `Requiere: ${level?.name ?? def.requires}`, hex(PALETTE.heart));
    }

    const by = 158;
    const buyLabel = check.ok ? `${owned ? 'Mejorar' : 'Comprar'} ${check.cost}` : check.reason === 'maxed' ? 'Maximo' : `${owned ? 'Mejorar' : 'Comprar'} ${check.cost ?? ''}`;
    const buy = createTextButton(this, x + 30, by, buyLabel, () => this.buy(def), 60, 14);
    if (!check.ok) buy.setAlpha(0.5);
    if (owned === 0) return;
    if (def.slot === 'passive') {
      createTextButton(this, x + 96, by, profile.isEquipped(def.id) ? 'Quitar' : 'Equipar', () => this.toggleEquip(def), 60, 14);
      return;
    }
    ABILITY_BUTTONS.forEach((button, i) => {
      const on = profile.slotOf(def.id) === button;
      const b = createTextButton(this, x + 82 + i * 38, by, `Equipar ${keyLabel(button)}`, () => this.equipOn(def, button), 36, 14);
      if (on) b.setAlpha(0.5);
    });
    if (profile.isEquipped(def.id)) createTextButton(this, x + 82, by - 16, 'Quitar', () => this.toggleEquip(def), 36, 12);
  }

  private select(index: number): void {
    if (this.list.length === 0) return;
    const next = Phaser.Math.Clamp(index, 0, this.list.length - 1);
    if (next !== this.selected) this.refresh('', next);
  }

  private highlight(): void {
    this.rows.forEach((row, i) => row.setFillStyle(i === this.selected ? 0x3d3470 : 0x2b2552));
  }

  private buy(def: AbilityDef | undefined): void {
    if (!def) return;
    const manager = getLevelManager();
    const result = getGameData().profile.purchase(def.id, (id) => manager.isCompleted(id));
    if (result.ok) playSound(this, AUDIO.star);
    this.refresh(result.ok ? `${def.name} nivel ${result.nextLevel}!` : MESSAGES[result.reason]);
  }

  private equipOn(def: AbilityDef | undefined, button: AbilityButton): void {
    if (!def) return;
    if (def.slot !== 'active') return this.refresh('Las pasivas no usan ranura');
    const ok = getGameData().profile.equipWeapon(def.id, button);
    this.refresh(ok ? `${def.name} en ${keyLabel(button)}` : 'Compra el arma primero');
  }

  private toggleEquip(def: AbilityDef | undefined): void {
    if (!def) return;
    const { profile } = getGameData();
    if (profile.isEquipped(def.id)) {
      profile.unequip(def.id);
      this.refresh(`${def.name} desequipada`);
    } else {
      this.refresh(profile.equip(def.id) ? `${def.name} equipada` : profile.levelOf(def.id) ? 'Elige ranura con F o R' : 'Compra la habilidad primero');
    }
  }

  private openAffinities(): void {
    const target = toAffinity(this.selected);
    this.scene.start(target.key, target.data);
  }

  private refresh(message: string, selected = this.selected): void {
    this.scene.restart({ selected, message });
  }
}

