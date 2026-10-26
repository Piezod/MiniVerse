import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../../core/config';
import { pixelText } from '../../../core/ui/pixelFont';
import { TEX, UI_FRAME } from '../assets/manifest';
import { hex, PALETTE } from '../assets/palette';
import { BIOMES } from '../biomes';
import { PlatformerScenes } from '../config';
import { defaultChapterId, gridCenters, type LevelCard, levelCards, moveSelection, type NavKey } from '../level/campaignView';
import { type LevelSelectData, openChapterSelect, startLevel } from '../level/levelFlow';
import { getCampaign } from '../level/levelLoader';
import { getGameData } from '../progression/gameData';

const CARD_W = 68;
const CARD_H = 84;
const GAP = 8;
const PER_ROW = 4;

/** Levels of one chapter: lock state and best stars. Opened from the chapter map. */
export class PlatformerLevelSelectScene extends Phaser.Scene {
  static readonly KEY = PlatformerScenes.LevelSelect;

  private cards: LevelCard[] = [];
  private frames: Phaser.GameObjects.Rectangle[] = [];
  private selected = 0;

  constructor() {
    super(PlatformerLevelSelectScene.KEY);
  }

  create(data?: LevelSelectData): void {
    const campaign = getCampaign();
    const chapterId = defaultChapterId(campaign, data?.chapterId);
    if (!chapterId) {
      this.scene.start(PlatformerScenes.ChapterSelect);
      return;
    }
    campaign.lastChapterId = chapterId;
    const chapter = campaign.chapter(chapterId)!;
    this.cards = levelCards(campaign, chapterId);
    this.frames = [];
    this.cameras.main.setBackgroundColor('#151634').fadeIn(250, 12, 11, 28);
    const rnd = new Phaser.Math.RandomDataGenerator(['levels']);
    for (let i = 0; i < 50; i++) this.add.rectangle(rnd.between(0, GAME_WIDTH), rnd.between(0, GAME_HEIGHT), 1, 1, 0xfff3d6, rnd.realInRange(0.2, 0.8));

    pixelText(this, GAME_WIDTH / 2, 16, chapter.name, hex(PALETTE.gold), 2).setOrigin(0.5).setMaxWidth(GAME_WIDTH - 140);
    pixelText(this, GAME_WIDTH / 2, 32, 'Elige un nivel', 0x9a86c4).setOrigin(0.5);

    const back = this.add.rectangle(30, 12, 50, 14, 0x141327, 0.6).setStrokeStyle(1, 0xfff8ec, 0.5).setInteractive({ useHandCursor: true });
    pixelText(this, 30, 12, '< CAPITULOS').setOrigin(0.5);
    back.on('pointerup', () => this.back());

    const shop = this.add.rectangle(GAME_WIDTH - 24, 12, 40, 14, 0x4a3f8a).setStrokeStyle(1, hex(PALETTE.gold)).setInteractive({ useHandCursor: true });
    pixelText(this, GAME_WIDTH - 24, 12, 'TIENDA', hex(PALETTE.goldLight)).setOrigin(0.5);
    shop.on('pointerup', () => this.openShop());
    this.add.image(GAME_WIDTH - 38, 26, TEX.ui, UI_FRAME.star);
    pixelText(this, GAME_WIDTH - 32, 26, String(getGameData().profile.balance), hex(PALETTE.goldLight)).setOrigin(0, 0.5);

    gridCenters(this.cards.length, PER_ROW, CARD_W, CARD_H, GAP, GAME_WIDTH / 2, 100).forEach((c, i) => this.createCard(i, c.x, c.y));

    const keyboard = this.input.keyboard;
    for (const key of ['LEFT', 'RIGHT', 'UP', 'DOWN'] as const) keyboard?.on(`keydown-${key}`, () => this.move(key));
    keyboard?.on('keydown-ENTER', () => this.play(this.selected));
    keyboard?.on('keydown-SPACE', () => this.play(this.selected));
    keyboard?.on('keydown-ESC', () => this.back());
    keyboard?.on('keydown-T', () => this.openShop());

    const latest = [...this.cards].reverse().find((c) => c.unlocked);
    this.select(latest ? this.cards.indexOf(latest) : 0);
  }

  private createCard(index: number, x: number, y: number): void {
    const entry = this.cards[index];
    const accent = BIOMES[entry.biome]?.accentColor ?? 0x52547e;
    const unlocked = entry.unlocked;
    const top = y - CARD_H / 2;

    const frame = this.add.rectangle(x, y, CARD_W, CARD_H, 0x2b2552).setStrokeStyle(2, unlocked ? accent : 0x52547e).setInteractive({ useHandCursor: true });
    this.add.rectangle(x, top + 15, CARD_W - 4, 26, unlocked ? accent : 0x383a5e).setAlpha(unlocked ? 0.85 : 0.6);
    pixelText(this, x, top + 15, String(entry.position), unlocked ? 0xffffff : 0x7a7caa, 3).setOrigin(0.5);
    pixelText(this, x, top + 38, entry.name, unlocked ? 0xfff8ec : 0x7a7caa).setMaxWidth(CARD_W - 8).setCenterAlign().setOrigin(0.5, 0);

    if (entry.planned) {
      pixelText(this, x, top + CARD_H - 12, 'Proximamente', 0x9a86c4).setOrigin(0.5);
    } else if (!entry.valid) {
      pixelText(this, x, top + CARD_H - 12, 'Error', hex(PALETTE.heart)).setOrigin(0.5);
    } else if (!unlocked) {
      this.drawLock(x, top + CARD_H - 14);
    } else {
      this.add.image(x - 14, top + CARD_H - 12, TEX.ui, UI_FRAME.star);
      pixelText(this, x - 8, top + CARD_H - 12, `${entry.stars}/${entry.starsTotal}`, entry.completed ? hex(PALETTE.goldLight) : 0x9a86c4).setOrigin(0, 0.5);
    }

    frame.on('pointerover', () => this.select(index));
    frame.on('pointerup', () => {
      this.select(index);
      this.play(index);
    });
    this.frames.push(frame);
  }

  private back(): void {
    openChapterSelect(this);
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

  private move(key: NavKey): void {
    this.select(moveSelection(this.selected, key, this.cards.length, PER_ROW));
  }

  private select(index: number): void {
    if (this.frames.length === 0) return;
    this.selected = Phaser.Math.Clamp(index, 0, this.frames.length - 1);
    this.frames.forEach((frame, i) => frame.setFillStyle(i === this.selected ? 0x4a3f8a : 0x2b2552));
  }

  private play(index: number): void {
    const entry = this.cards[index];
    if (!entry || !entry.unlocked || !entry.valid) {
      this.cameras.main.shake(120, 0.01);
      return;
    }
    startLevel(this, entry.id);
  }
}
