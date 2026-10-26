import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../../core/config';
import { pixelText } from '../../../core/ui/pixelFont';
import { createTextButton } from '../../../core/ui/TextButton';
import { hex, PALETTE } from '../assets/palette';
import { AFFINITY_KEYS, affinityArrows, affinityNodes, fromAffinity, type Matchup } from '../progression/affinityInfo';
import { PlatformerScenes } from '../config';
import { getGameData } from '../progression/gameData';

const CENTER_X = 96;
const CENTER_Y = 96;
const RADIUS = 52;

/**
 * Informative screen with the affinity circle loaded from elements.json: each element points to
 * the one it beats (×advantage); the inverse relation deals ×disadvantage.
 */
export class PlatformerAffinityScene extends Phaser.Scene {
  static readonly KEY = PlatformerScenes.Affinity;
  private returnSelected = 0;

  constructor() {
    super(PlatformerAffinityScene.KEY);
  }

  create(data?: { selected?: number }): void {
    this.returnSelected = data?.selected ?? 0;
    const { chart } = getGameData();
    const nodes = affinityNodes(chart);
    const ids = nodes.map((n) => n.id);
    this.cameras.main.setBackgroundColor('#151634');
    pixelText(this, GAME_WIDTH / 2, 12, 'Afinidades', hex(PALETTE.gold), 2).setOrigin(0.5);

    const points = ids.map((id, i) => {
      const angle = -Math.PI / 2 + (i / ids.length) * Math.PI * 2;
      return { id, x: CENTER_X + Math.cos(angle) * RADIUS, y: CENTER_Y + Math.sin(angle) * RADIUS };
    });
    const g = this.add.graphics();
    for (const { from, to } of affinityArrows(chart)) {
      this.arrow(g, points.find((p) => p.id === from)!, points.find((p) => p.id === to)!, hex(chart.elements[from].color));
    }
    for (const p of points) {
      const el = chart.elements[p.id];
      this.add.circle(p.x, p.y, 7, 0x141327).setStrokeStyle(2, hex(el.color));
      pixelText(this, p.x, p.y + (p.y < CENTER_Y ? -12 : 12), el.name, hex(el.color)).setOrigin(0.5);
    }

    // Matchup list: strong / weak per element.
    const x = 182;
    let y = 30;
    pixelText(this, x, y, 'Ataque     fuerte / debil', 0x9a86c4);
    y += 12;
    const list = (items: Matchup[]): string => (items.length ? `x${items[0].multiplier} ${items.map((m) => m.name).join(',')}` : '-');
    for (const node of nodes) {
      pixelText(this, x, y, node.name, hex(node.color));
      pixelText(this, x + 4, y + 9, list(node.strong), hex(PALETTE.moss));
      pixelText(this, x + 4, y + 18, list(node.weak), hex(PALETTE.heart));
      y += 28;
    }
    pixelText(this, CENTER_X, GAME_HEIGHT - 16, 'Flecha: ventaja ofensiva', 0x9a86c4).setOrigin(0.5);

    createTextButton(this, 34, 12, '< Tienda', () => this.back(), 52, 14);
    const keyboard = this.input.keyboard;
    for (const key of AFFINITY_KEYS.back) keyboard?.on(`keydown-${key}`, () => this.back());
  }

  private arrow(g: Phaser.GameObjects.Graphics, from: { x: number; y: number }, to: { x: number; y: number }, color: number): void {
    const angle = Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y);
    const sx = from.x + Math.cos(angle) * 10;
    const sy = from.y + Math.sin(angle) * 10;
    const ex = to.x - Math.cos(angle) * 10;
    const ey = to.y - Math.sin(angle) * 10;
    g.lineStyle(1, color, 0.9).lineBetween(sx, sy, ex, ey);
    const head = (a: number): [number, number] => [ex - Math.cos(a) * 5, ey - Math.sin(a) * 5];
    g.fillStyle(color).fillTriangle(ex, ey, ...head(angle - 0.45), ...head(angle + 0.45));
  }

  private back(): void {
    const target = fromAffinity(this.returnSelected);
    this.scene.start(target.key, target.data);
  }
}

