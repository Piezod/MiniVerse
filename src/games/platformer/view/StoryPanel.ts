import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../../core/config';
import { pixelText, toPixelText } from '../../../core/ui/pixelFont';
import { hex, PALETTE } from '../assets/palette';
import type { StoryView } from '../story/StoryDirector';
import { DEPTH } from './ParallaxBackground';

const PANEL_X = 46;
const PANEL_Y = 22;
const PANEL_W = GAME_WIDTH - PANEL_X * 2;
const PANEL_H = 50;

const NAMES: Record<string, string> = { luma: 'LUMA', piezod: 'PIEZOD', transmision: 'TRANSMISION', nexar: 'NEXAR' };
const COLORS: Record<string, string> = { luma: PALETTE.glow, piezod: PALETTE.gold, transmision: '#ffb347', nexar: '#c86bff' };

/** Dialogue box at the top of the screen, driven by a StoryDirector view. Created hidden. */
export class StoryPanel {
  private readonly box: Phaser.GameObjects.Rectangle;
  private readonly name: Phaser.GameObjects.BitmapText;
  private readonly body: Phaser.GameObjects.BitmapText;
  private readonly hint: Phaser.GameObjects.BitmapText;
  private last = '';
  private clock = 0;
  private bottom = false;

  constructor(scene: Phaser.Scene) {
    const fixed = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth & Phaser.GameObjects.Components.Visible>(o: T): T =>
      o.setScrollFactor(0).setDepth(DEPTH.foreground + 3).setVisible(false);
    this.box = fixed(scene.add.rectangle(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 0x141327, 0.88).setOrigin(0).setStrokeStyle(1, 0x8f7cd6));
    this.name = fixed(pixelText(scene, PANEL_X + 5, PANEL_Y + 4, '', 0xffffff));
    this.body = fixed(pixelText(scene, PANEL_X + 5, PANEL_Y + 14, '', 0xfff8ec).setMaxWidth(PANEL_W - 10));
    this.hint = fixed(pixelText(scene, PANEL_X + PANEL_W - 5, PANEL_Y + PANEL_H - 4, '', 0x9a86c4).setOrigin(1, 1));
  }

  /** Call every frame with the director's view (null hides the panel). */
  render(view: StoryView | null, touch: boolean, dt: number, playerScreenY = GAME_HEIGHT): void {
    const visible = view !== null;
    for (const o of [this.box, this.name, this.body, this.hint]) o.setVisible(visible);
    if (!view) {
      this.last = '';
      return;
    }
    if (playerScreenY < 84) this.bottom = true;
    else if (playerScreenY > 104) this.bottom = false;
    const height = view.blocking ? PANEL_H : 42;
    const y = !view.blocking && this.bottom ? GAME_HEIGHT - height - 36 : PANEL_Y;
    this.box.setPosition(PANEL_X, y).setSize(PANEL_W, height);
    this.name.setY(y + 4);
    this.body.setY(y + 14);
    this.hint.setY(y + height - 4);
    this.clock += dt;
    const key = `${view.beatId}|${view.line}|${view.shown.length}`;
    if (key !== this.last) {
      this.last = key;
      this.name.setText(NAMES[view.speaker] ?? view.speaker.toUpperCase()).setTint(hex(COLORS[view.speaker] ?? PALETTE.white));
      this.body.setText(toPixelText(view.shown));
    }
    const more = view.line + 1 < view.lineCount;
    const prompt = touch ? 'TOCA' : 'ENTER';
    this.hint.setText(view.typed && view.blocking && Math.floor(this.clock * 2) % 2 === 0 ? `${prompt} ${more ? '>' : 'OK'}` : '');
  }

  destroy(): void {
    for (const o of [this.box, this.name, this.body, this.hint]) o.destroy();
  }
}
