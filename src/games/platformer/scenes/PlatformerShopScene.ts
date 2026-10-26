import Phaser from 'phaser';
import { playSound } from '../../../core/audio/Sfx';
import { GAME_HEIGHT, GAME_WIDTH } from '../../../core/config';
import { pixelText } from '../../../core/ui/pixelFont';
import { createTextButton } from '../../../core/ui/TextButton';
import type { AbilityDef } from '../abilities/AbilityCatalog';
import { AUDIO, TEX, UI_FRAME } from '../assets/manifest';
import { hex, PALETTE } from '../assets/palette';
import { PlatformerScenes } from '../config';
import { openLevelSelect } from '../level/levelFlow';
import { getLevelManager } from '../level/levelLoader';
import { getGameData } from '../progression/gameData';
import { MAX_ACTIVE_ABILITIES } from '../progression/Profile';

const ROW_H = 38;
const MESSAGES = {
  maxed: 'Nivel maximo alcanzado',
  locked: 'Completa el nivel requerido',
  funds: 'No tienes suficientes estrellas',
  unknown: 'Habilidad desconocida',
} as const;

/** Buy/upgrade abilities with stars and choose which ones are equipped. */
export class PlatformerShopScene extends Phaser.Scene {
  static readonly KEY = PlatformerScenes.Shop;

  private selected = 0;
  private message = '';
  private rows: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super(PlatformerShopScene.KEY);
  }

  create(data?: { selected?: number; message?: string }): void {
    this.selected = data?.selected ?? 0;
    this.message = data?.message ?? '';
    this.rows = [];
    const { profile, abilities } = getGameData();
    const list = Object.values(abilities.abilities);
    this.cameras.main.setBackgroundColor('#151634');

    pixelText(this, GAME_WIDTH / 2, 14, 'Tienda', hex(PALETTE.gold), 2).setOrigin(0.5);
    const back = this.add.rectangle(24, 12, 40, 14, 0x141327, 0.6).setStrokeStyle(1, 0xfff8ec, 0.5).setInteractive({ useHandCursor: true });
    pixelText(this, 24, 12, '< NIVELES').setOrigin(0.5);
    back.on('pointerup', () => openLevelSelect(this));
    this.add.image(GAME_WIDTH - 42, 12, TEX.ui, UI_FRAME.star);
    pixelText(this, GAME_WIDTH - 34, 12, String(profile.balance), hex(PALETTE.goldLight)).setOrigin(0, 0.5);
    pixelText(this, GAME_WIDTH / 2, 28, `Activas equipadas: ${profile.activeSlots.length}/${MAX_ACTIVE_ABILITIES}  (J/X y K/C)`, 0x9a86c4).setOrigin(0.5);

    list.forEach((def, i) => this.createRow(def, i, 42 + i * (ROW_H + 4)));
    pixelText(this, GAME_WIDTH / 2, GAME_HEIGHT - 8, this.message, hex(PALETTE.glow)).setOrigin(0.5);

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-UP', () => this.select(this.selected - 1));
    keyboard?.on('keydown-DOWN', () => this.select(this.selected + 1));
    keyboard?.on('keydown-ENTER', () => this.buy(list[this.selected]));
    keyboard?.on('keydown-E', () => this.toggleEquip(list[this.selected]));
    keyboard?.on('keydown-ESC', () => openLevelSelect(this));
    this.select(this.selected);
  }

  private createRow(def: AbilityDef, index: number, top: number): void {
    const { profile } = getGameData();
    const manager = getLevelManager();
    const owned = profile.levelOf(def.id);
    const check = profile.canPurchase(def.id, (id) => manager.isCompleted(id));
    const y = top + ROW_H / 2;

    const row = this.add.rectangle(GAME_WIDTH / 2, y, GAME_WIDTH - 12, ROW_H, 0x2b2552).setStrokeStyle(1, 0x4a3f8a).setInteractive();
    row.on('pointerdown', () => this.select(index));
    this.rows.push(row);

    this.add.image(20, y, TEX.abilityIcons, def.icon).setScale(2);
    pixelText(this, 34, top + 6, `${def.name}  NV ${owned}/${def.levels.length}`, owned ? hex(PALETTE.goldLight) : 0xfff8ec);
    pixelText(this, 34, top + 15, def.description, 0x9a86c4).setMaxWidth(150);
    if (check.ok === false && check.reason === 'locked' && def.requires) {
      const level = manager.get(def.requires);
      pixelText(this, 224, y + 9, `Requiere: ${level?.name ?? def.requires}`, hex(PALETTE.heart)).setOrigin(0.5).setMaxWidth(110);
    }

    const buyLabel = check.ok ? `${owned ? 'Mejorar' : 'Comprar'} ${check.cost}` : check.reason === 'maxed' ? 'Maximo' : `${owned ? 'Mejorar' : 'Comprar'} ${check.cost ?? ''}`;
    const buy = createTextButton(this, 224, y - 7, buyLabel, () => this.buy(def), 72, 14);
    if (!check.ok) buy.setAlpha(0.5);
    if (owned > 0) {
      const equipped = profile.isEquipped(def.id);
      createTextButton(this, 224, y + 9, equipped ? 'Quitar' : 'Equipar', () => this.toggleEquip(def), 72, 14);
      if (equipped) pixelText(this, 290, y, 'EQUIP.', hex(PALETTE.glow)).setOrigin(0.5);
    }
  }

  private select(index: number): void {
    if (this.rows.length === 0) return;
    this.selected = Phaser.Math.Clamp(index, 0, this.rows.length - 1);
    this.rows.forEach((row, i) => row.setFillStyle(i === this.selected ? 0x3d3470 : 0x2b2552));
  }

  private buy(def: AbilityDef | undefined): void {
    if (!def) return;
    const manager = getLevelManager();
    const result = getGameData().profile.purchase(def.id, (id) => manager.isCompleted(id));
    if (result.ok) playSound(this, AUDIO.star);
    this.refresh(result.ok ? `${def.name} nivel ${result.nextLevel}!` : MESSAGES[result.reason]);
  }

  private toggleEquip(def: AbilityDef | undefined): void {
    if (!def) return;
    const { profile } = getGameData();
    if (profile.isEquipped(def.id)) {
      profile.unequip(def.id);
      this.refresh(`${def.name} desequipada`);
    } else {
      this.refresh(profile.equip(def.id) ? `${def.name} equipada` : 'Quita otra habilidad activa primero');
    }
  }

  private refresh(message: string): void {
    this.scene.restart({ selected: this.selected, message });
  }
}
