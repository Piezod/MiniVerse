import type Phaser from 'phaser';
import { pixelText } from './pixelFont';

const IDLE = 0x2b2552;
const PRESSED = 0x4a3f8a;

export function createTextButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  width = 96,
  height = 18,
): Phaser.GameObjects.Container {
  const bg = scene.add.rectangle(0, 0, width, height, IDLE).setStrokeStyle(1, 0xffd56b);
  const text = pixelText(scene, 0, 0, label).setOrigin(0.5);
  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerdown', () => bg.setFillStyle(PRESSED));
  bg.on('pointerout', () => bg.setFillStyle(IDLE));
  bg.on('pointerup', () => {
    bg.setFillStyle(IDLE);
    onClick();
  });
  return scene.add.container(x, y, [bg, text]);
}
