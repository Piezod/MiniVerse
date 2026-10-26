import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../../core/config';
import { exitToMenu } from '../../../core/minigame/MiniGameLauncher';
import { pixelText } from '../../../core/ui/pixelFont';
import { TEX, UI_FRAME } from '../assets/manifest';
import { hex, PALETTE } from '../assets/palette';
import { BIOMES } from '../biomes';
import { PlatformerScenes } from '../config';
import { startLevel } from '../level/levelFlow';
import { getLevelManager } from '../level/levelLoader';
import { getGameData } from '../progression/gameData';

const CARD_W = 68;
const CARD_H = 84;
const GAP = 8;
const PER_ROW = 4;

/** Campaign map: shows every level in levels.json, locked/unlocked state and best stars. */
export class PlatformerLevelSelectScene extends Phaser.Scene {
  static readonly KEY = PlatformerScenes.LevelSelect;

  private cards: Phaser.GameObjects.Rectangle[] = [];
  private selected = 0;

  constructor() {
    super(PlatformerLevelSelectScene.KEY);
  }

  create(): void {
    const manager = getLevelManager();
    this.cards = [];
    this.cameras.main.setBackgroundColor('#151634').fadeIn(250, 12, 11, 28);
    const rnd = new Phaser.Math.RandomDataGenerator(['levels']);
    for (let i = 0; i < 50; i++) this.add.rectangle(rnd.between(0, GAME_WIDTH), rnd.between(0, GAME_HEIGHT), 1, 1, 0xfff3d6, rnd.realInRange(0.2, 0.8));

    pixelText(this, GAME_WIDTH / 2, 16, 'Aventuras Pixel', hex(PALETTE.gold), 2).setOrigin(0.5);
    pixelText(this, GAME_WIDTH / 2, 32, 'Elige un nivel', 0x9a86c4).setOrigin(0.5);

    const back = this.add.rectangle(20, 12, 30, 14, 0x141327, 0.6).setStrokeStyle(1, 0xfff8ec, 0.5).setInteractive({ useHandCursor: true });
    pixelText(this, 20, 12, '< MENU').setOrigin(0.5);
    back.on('pointerup', () => exitToMenu(this));

    const shop = this.add.rectangle(GAME_WIDTH - 24, 12, 40, 14, 0x4a3f8a).setStrokeStyle(1, hex(PALETTE.gold)).setInteractive({ useHandCursor: true });
    pixelText(this, GAME_WIDTH - 24, 12, 'TIENDA', hex(PALETTE.goldLight)).setOrigin(0.5);
    shop.on('pointerup', () => this.openShop());
    this.add.image(GAME_WIDTH - 38, 26, TEX.ui, UI_FRAME.star);
    pixelText(this, GAME_WIDTH - 32, 26, String(getGameData().profile.balance), hex(PALETTE.goldLight)).setOrigin(0, 0.5);

    const levels = manager.levels;
    const rowsCount = Math.ceil(levels.length / PER_ROW);
    levels.forEach((_entry, i) => {
      const row = Math.floor(i / PER_ROW);
      const inRow = Math.min(PER_ROW, levels.length - row * PER_ROW);
      const startX = (GAME_WIDTH - (inRow * CARD_W + (inRow - 1) * GAP)) / 2 + CARD_W / 2;
      const x = startX + (i % PER_ROW) * (CARD_W + GAP);
      const y = 100 + (row - (rowsCount - 1) / 2) * (CARD_H + GAP);
      this.createCard(i, x, y);
    });

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-LEFT', () => this.select(this.selected - 1));
    keyboard?.on('keydown-RIGHT', () => this.select(this.selected + 1));
    keyboard?.on('keydown-UP', () => this.select(this.selected - PER_ROW));
    keyboard?.on('keydown-DOWN', () => this.select(this.selected + PER_ROW));
    keyboard?.on('keydown-ENTER', () => this.play(this.selected));
    keyboard?.on('keydown-SPACE', () => this.play(this.selected));
    keyboard?.on('keydown-ESC', () => exitToMenu(this));
    keyboard?.on('keydown-T', () => this.openShop());

    const latest = manager.latestUnlocked();
    this.select(latest ? latest.index : 0);
  }

  private createCard(index: number, x: number, y: number): void {
    const manager = getLevelManager();
    const entry = manager.levels[index];
    const biome = BIOMES[entry.biome];
    const unlocked = manager.isUnlocked(entry.id);
    const accent = biome?.accentColor ?? 0x52547e;
    const top = y - CARD_H / 2;

    const card = this.add.rectangle(x, y, CARD_W, CARD_H, 0x2b2552).setStrokeStyle(2, unlocked ? accent : 0x52547e).setInteractive({ useHandCursor: true });
    this.add.rectangle(x, top + 15, CARD_W - 4, 26, unlocked ? accent : 0x383a5e).setAlpha(unlocked ? 0.85 : 0.6);
    pixelText(this, x, top + 15, String(index + 1), unlocked ? 0xffffff : 0x7a7caa, 3).setOrigin(0.5);
    pixelText(this, x, top + 38, entry.name, unlocked ? 0xfff8ec : 0x7a7caa).setMaxWidth(CARD_W - 8).setCenterAlign().setOrigin(0.5, 0);

    if (!entry.validation.ok) {
      pixelText(this, x, top + CARD_H - 12, 'Error', hex(PALETTE.heart)).setOrigin(0.5);
    } else if (!unlocked) {
      this.drawLock(x, top + CARD_H - 14);
    } else {
      const best = manager.best(entry.id);
      const total = entry.validation.parsed?.stars.length ?? 0;
      this.add.image(x - 14, top + CARD_H - 12, TEX.ui, UI_FRAME.star);
      pixelText(this, x - 8, top + CARD_H - 12, `${best?.stars ?? 0}/${total}`, best ? hex(PALETTE.goldLight) : 0x9a86c4).setOrigin(0, 0.5);
    }

    card.on('pointerover', () => this.select(index));
    card.on('pointerup', () => {
      this.select(index);
      this.play(index);
    });
    this.cards.push(card);
  }

  private openShop(): void {
    this.scene.start(PlatformerScenes.Shop);
  }

  private drawLock(x: number, y: number): void {
    const g = this.add.graphics();
    g.lineStyle(2, 0x7a7caa).strokeRect(x - 3, y - 7, 6, 6);
    g.fillStyle(0x7a7caa).fillRect(x - 5, y - 3, 10, 8);
    g.fillStyle(0x2b2552).fillRect(x - 1, y, 2, 3);
  }

  private select(index: number): void {
    if (this.cards.length === 0) return;
    this.selected = Phaser.Math.Clamp(index, 0, this.cards.length - 1);
    this.cards.forEach((card, i) => card.setFillStyle(i === this.selected ? 0x4a3f8a : 0x2b2552));
  }

  private play(index: number): void {
    const entry = getLevelManager().levels[index];
    if (!entry || !getLevelManager().isUnlocked(entry.id)) {
      this.cameras.main.shake(120, 0.01);
      return;
    }
    startLevel(this, entry.id);
  }
}
