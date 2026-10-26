import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SceneKeys } from '../core/config';
import { getMiniGames } from '../core/minigame/GameRegistry';
import type { MiniGameInfo } from '../core/minigame/MiniGame';
import { launchMiniGame, releasePendingMiniGame } from '../core/minigame/MiniGameLauncher';
import { pixelText, toPixelText } from '../core/ui/pixelFont';

const CARD_WIDTH = 130;
const CARD_HEIGHT = 74;
const CARD_GAP = 10;

export class MainMenuScene extends Phaser.Scene {
  static readonly KEY = SceneKeys.MainMenu;

  private games: MiniGameInfo[] = [];
  private cards: Phaser.GameObjects.Rectangle[] = [];
  private selected = 0;
  private loading = false;
  private status!: Phaser.GameObjects.BitmapText;

  constructor() {
    super(MainMenuScene.KEY);
  }

  create(): void {
    releasePendingMiniGame(this.game);
    this.games = getMiniGames();
    this.cards = [];
    this.selected = 0;
    this.loading = false;

    this.cameras.main.setBackgroundColor('#151634');
    const rnd = new Phaser.Math.RandomDataGenerator(['miniverse']);
    for (let i = 0; i < 60; i++) {
      this.add.rectangle(rnd.between(0, GAME_WIDTH), rnd.between(0, GAME_HEIGHT), 1, 1, 0xfff3d6, rnd.realInRange(0.2, 0.9));
    }

    pixelText(this, GAME_WIDTH / 2, 26, 'MiniVerse', 0xffd56b, 3).setOrigin(0.5);
    pixelText(this, GAME_WIDTH / 2, 46, 'Elige un minijuego', 0x9a86c4).setOrigin(0.5);

    const totalWidth = this.games.length * CARD_WIDTH + (this.games.length - 1) * CARD_GAP;
    const startX = (GAME_WIDTH - totalWidth) / 2 + CARD_WIDTH / 2;
    this.games.forEach((info, i) => this.createCard(info, startX + i * (CARD_WIDTH + CARD_GAP), 104, i));

    this.status = pixelText(this, GAME_WIDTH / 2, GAME_HEIGHT - 12, '', 0x9a86c4).setOrigin(0.5);

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-LEFT', () => this.select(this.selected - 1));
    keyboard?.on('keydown-RIGHT', () => this.select(this.selected + 1));
    keyboard?.on('keydown-ENTER', () => this.launchSelected());
    keyboard?.on('keydown-SPACE', () => this.launchSelected());
    this.select(0);
  }

  private createCard(info: MiniGameInfo, x: number, y: number, index: number): void {
    const top = y - CARD_HEIGHT / 2;
    const card = this.add
      .rectangle(x, y, CARD_WIDTH, CARD_HEIGHT, 0x2b2552)
      .setStrokeStyle(2, info.accentColor)
      .setInteractive({ useHandCursor: true });
    this.add.rectangle(x, top + 8, CARD_WIDTH, 16, info.accentColor);
    pixelText(this, x, top + 8, info.title).setOrigin(0.5);
    pixelText(this, x, y + 4, info.description, 0xd6d0f0).setMaxWidth(CARD_WIDTH - 12).setCenterAlign().setOrigin(0.5);
    pixelText(this, x, top + CARD_HEIGHT - 9, '> Jugar', 0xffd56b).setOrigin(0.5);

    card.on('pointerover', () => this.select(index));
    card.on('pointerup', () => {
      this.select(index);
      this.launchSelected();
    });
    this.cards.push(card);
  }

  private select(index: number): void {
    if (this.cards.length === 0) return;
    this.selected = Phaser.Math.Wrap(index, 0, this.cards.length);
    this.cards.forEach((card, i) => card.setFillStyle(i === this.selected ? 0x4a3f8a : 0x2b2552));
  }

  private launchSelected(): void {
    const info = this.games[this.selected];
    if (!info || this.loading) return;
    this.loading = true;
    this.status.setText(toPixelText('Cargando...'));
    launchMiniGame(this, info).catch((error: unknown) => {
      console.error(`Failed to load minigame "${info.id}"`, error);
      this.status.setText(toPixelText('Error al cargar el minijuego'));
      this.loading = false;
    });
  }
}
