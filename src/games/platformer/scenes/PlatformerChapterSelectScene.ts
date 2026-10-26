import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../../core/config';
import { exitToMenu } from '../../../core/minigame/MiniGameLauncher';
import { pixelText } from '../../../core/ui/pixelFont';
import { TEX, UI_FRAME } from '../assets/manifest';
import { hex, PALETTE } from '../assets/palette';
import { BIOMES } from '../biomes';
import { PlatformerScenes } from '../config';
import { type ChapterCard, chapterCards, defaultChapterId, gridCenters, moveSelection, type NavKey } from '../level/campaignView';
import { getCampaign } from '../level/levelLoader';
import { getGameData } from '../progression/gameData';

const CARD_W = 96;
const CARD_H = 108;
const GAP = 8;
const PER_ROW = 3;
const MUTED = 0x9a86c4;

/** Chapter map: progress, stars and lock state per chapter; opening one shows its levels. */
export class PlatformerChapterSelectScene extends Phaser.Scene {
  static readonly KEY = PlatformerScenes.ChapterSelect;

  private cards: ChapterCard[] = [];
  private frames: Phaser.GameObjects.Rectangle[] = [];
  private hint!: Phaser.GameObjects.BitmapText;
  private selected = 0;

  constructor() {
    super(PlatformerChapterSelectScene.KEY);
  }

  create(): void {
    const campaign = getCampaign();
    this.cards = chapterCards(campaign, (id) => BIOMES[id]?.name ?? id);
    this.frames = [];
    this.cameras.main.setBackgroundColor('#151634').fadeIn(250, 12, 11, 28);
    const rnd = new Phaser.Math.RandomDataGenerator(['chapters']);
    for (let i = 0; i < 50; i++) this.add.rectangle(rnd.between(0, GAME_WIDTH), rnd.between(0, GAME_HEIGHT), 1, 1, 0xfff3d6, rnd.realInRange(0.2, 0.8));

    pixelText(this, GAME_WIDTH / 2, 16, 'Aventuras Pixel', hex(PALETTE.gold), 2).setOrigin(0.5);
    pixelText(this, GAME_WIDTH / 2, 32, 'Elige un capitulo', MUTED).setOrigin(0.5);

    const back = this.add.rectangle(20, 12, 30, 14, 0x141327, 0.6).setStrokeStyle(1, 0xfff8ec, 0.5).setInteractive({ useHandCursor: true });
    pixelText(this, 20, 12, '< MENU').setOrigin(0.5);
    back.on('pointerup', () => exitToMenu(this));
    const shop = this.add.rectangle(GAME_WIDTH - 24, 12, 40, 14, 0x4a3f8a).setStrokeStyle(1, hex(PALETTE.gold)).setInteractive({ useHandCursor: true });
    pixelText(this, GAME_WIDTH - 24, 12, 'TIENDA', hex(PALETTE.goldLight)).setOrigin(0.5);
    shop.on('pointerup', () => this.openShop());
    this.add.image(GAME_WIDTH - 38, 26, TEX.ui, UI_FRAME.star);
    pixelText(this, GAME_WIDTH - 32, 26, String(getGameData().profile.balance), hex(PALETTE.goldLight)).setOrigin(0, 0.5);

    gridCenters(this.cards.length, PER_ROW, CARD_W, CARD_H, GAP, GAME_WIDTH / 2, 98).forEach((c, i) => this.createCard(i, c.x, c.y));
    this.hint = pixelText(this, GAME_WIDTH / 2, GAME_HEIGHT - 8, '', MUTED).setOrigin(0.5);

    const keyboard = this.input.keyboard;
    for (const key of ['LEFT', 'RIGHT', 'UP', 'DOWN'] as const) keyboard?.on(`keydown-${key}`, () => this.move(key));
    keyboard?.on('keydown-ENTER', () => this.open(this.selected));
    keyboard?.on('keydown-SPACE', () => this.open(this.selected));
    keyboard?.on('keydown-ESC', () => exitToMenu(this));
    keyboard?.on('keydown-T', () => this.openShop());

    const preferred = defaultChapterId(campaign);
    this.select(Math.max(0, this.cards.findIndex((c) => c.id === preferred)));
  }

  private createCard(index: number, x: number, y: number): void {
    const card = this.cards[index];
    const biome = BIOMES[campaignBiome(card.id)];
    const accent = card.selectable ? (biome?.accentColor ?? 0x8f7cd6) : 0x52547e;
    const top = y - CARD_H / 2;
    const dim = card.selectable ? 0xfff8ec : 0x7a7caa;

    const frame = this.add.rectangle(x, y, CARD_W, CARD_H, 0x2b2552).setStrokeStyle(2, accent).setInteractive({ useHandCursor: true });
    this.add.rectangle(x, top + 12, CARD_W - 4, 20, accent).setAlpha(card.selectable ? 0.85 : 0.5);
    pixelText(this, x, top + 12, String(index), card.selectable ? 0xffffff : 0x9a9cc0, 2).setOrigin(0.5);
    pixelText(this, x, top + 26, card.name, dim).setMaxWidth(CARD_W - 8).setCenterAlign().setOrigin(0.5, 0);
    pixelText(this, x, top + 46, card.description, 0x9a9cc0).setMaxWidth(CARD_W - 10).setCenterAlign().setOrigin(0.5, 0);
    pixelText(this, x, top + CARD_H - 38, card.biome, accent).setOrigin(0.5);

    if (card.selectable || card.completed) {
      pixelText(this, x - CARD_W / 2 + 6, top + CARD_H - 26, `Niveles ${card.levels}`, dim);
      this.add.image(x - CARD_W / 2 + 10, top + CARD_H - 12, TEX.ui, UI_FRAME.star);
      pixelText(this, x - CARD_W / 2 + 16, top + CARD_H - 12, card.stars, hex(PALETTE.goldLight)).setOrigin(0, 0.5);
      if (card.completed) pixelText(this, x + CARD_W / 2 - 6, top + CARD_H - 12, 'OK', hex(PALETTE.moss)).setOrigin(1, 0.5);
    } else {
      pixelText(this, x, top + CARD_H - 14, card.stateLabel, card.status === 'planned' ? MUTED : hex(PALETTE.heart)).setOrigin(0.5);
    }

    frame.on('pointerover', () => this.select(index));
    frame.on('pointerup', () => {
      this.select(index);
      this.open(index);
    });
    this.frames.push(frame);
  }

  private move(key: NavKey): void {
    this.select(moveSelection(this.selected, key, this.cards.length, PER_ROW));
  }

  private select(index: number): void {
    if (this.frames.length === 0) return;
    this.selected = Phaser.Math.Clamp(index, 0, this.frames.length - 1);
    this.frames.forEach((frame, i) => frame.setFillStyle(i === this.selected ? 0x4a3f8a : 0x2b2552));
    const card = this.cards[this.selected];
    this.hint.setText(card.selectable ? 'Enter: abrir capitulo   T: tienda' : card.status === 'planned' ? 'Este capitulo llegara pronto' : card.requires.length ? `Completa antes: ${card.requires.join(', ')}` : card.stateLabel);
  }

  private open(index: number): void {
    const card = this.cards[index];
    if (!card?.selectable) {
      this.cameras.main.shake(120, 0.01);
      return;
    }
    this.scene.start(PlatformerScenes.LevelSelect, { chapterId: card.id });
  }

  private openShop(): void {
    this.scene.start(PlatformerScenes.Shop);
  }
}

function campaignBiome(chapterId: string): string {
  return getCampaign().chapter(chapterId)?.biome ?? '';
}
