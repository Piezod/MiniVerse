import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../../core/config';
import { exitToMenu } from '../../../core/minigame/MiniGameLauncher';
import { createTextButton } from '../../../core/ui/TextButton';
import { pixelText } from '../../../core/ui/pixelFont';
import { TEX, UI_FRAME } from '../assets/manifest';
import { hex, PALETTE } from '../assets/palette';
import { LevelEvent, PLAYER_MAX_HP, PlatformerScenes, type PlatformerAction } from '../config';
import { openLevelSelect, startLevel } from '../level/levelFlow';
import { getGameData } from '../progression/gameData';
import type { PlatformerLevelScene } from './PlatformerLevelScene';

export interface HudData {
  level: PlatformerLevelScene;
}

/** UI overlay: counters, touch controls, pause/victory/defeat screens. Runs on top of the level. */
export class PlatformerHudScene extends Phaser.Scene {
  static readonly KEY = PlatformerScenes.Hud;

  private level!: PlatformerLevelScene;
  private starsText!: Phaser.GameObjects.BitmapText;
  private hearts: Phaser.GameObjects.Image[] = [];
  private livesText!: Phaser.GameObjects.BitmapText;
  private energyBar!: Phaser.GameObjects.Graphics;
  private slots: Array<{ x: number; y: number; size: number; overlay: Phaser.GameObjects.Graphics }> = [];
  private muteIcon!: Phaser.GameObjects.Image;
  private overlay: Phaser.GameObjects.Container | null = null;
  private overlayPrimary: (() => void) | null = null;
  private paused = false;
  private ended = false;

  constructor() {
    super(PlatformerHudScene.KEY);
  }

  create(data: HudData): void {
    this.level = data.level;
    this.overlay = null;
    this.overlayPrimary = null;
    this.paused = false;
    this.ended = false;

    this.add.image(6, 6, TEX.ui, UI_FRAME.star).setOrigin(0);
    this.starsText = pixelText(this, 16, 7, '', hex(PALETTE.goldLight));
    this.hearts = Array.from({ length: PLAYER_MAX_HP }, (_, i) => this.add.image(6 + i * 9, 16, TEX.ui, UI_FRAME.heart).setOrigin(0));
    this.livesText = pixelText(this, 8 + PLAYER_MAX_HP * 9, 17, '', 0xfff8ec);
    this.energyBar = this.add.graphics();
    this.slots = [];
    this.updateStars(this.level.starCount, this.level.starTotal);
    this.updateLives(this.level.livesLeft);
    this.updateHealth(this.level.health.current);

    this.createIconButton(GAME_WIDTH - 12, 10, UI_FRAME.pause, () => this.pauseGame());
    this.muteIcon = this.createIconButton(GAME_WIDTH - 30, 10, UI_FRAME.soundOn, () => this.toggleMute());
    this.refreshMute();

    const touch = this.sys.game.device.input.touch;
    if (touch) this.createTouchControls();
    this.createAbilitySlots(touch);

    const bus = this.level.bus;
    bus.on(LevelEvent.Stars, this.updateStars, this);
    bus.on(LevelEvent.Lives, this.updateLives, this);
    bus.on(LevelEvent.Health, this.updateHealth, this);
    bus.on(LevelEvent.Victory, this.onVictory, this);
    bus.on(LevelEvent.GameOver, this.onGameOver, this);

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-ESC', this.togglePause, this);
    keyboard?.on('keydown-P', this.togglePause, this);
    keyboard?.on('keydown-M', this.toggleMute, this);
    keyboard?.on('keydown-ENTER', () => this.overlayPrimary?.());

    this.game.events.on(Phaser.Core.Events.BLUR, this.pauseGame, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off(LevelEvent.Stars, this.updateStars, this);
      bus.off(LevelEvent.Lives, this.updateLives, this);
      bus.off(LevelEvent.Health, this.updateHealth, this);
      bus.off(LevelEvent.Victory, this.onVictory, this);
      bus.off(LevelEvent.GameOver, this.onGameOver, this);
      this.game.events.off(Phaser.Core.Events.BLUR, this.pauseGame, this);
      this.level.controls.clearTouch();
    });
  }

  private updateStars(count: number, total: number): void {
    this.starsText.setText(`${count}/${total}`);
  }

  private updateLives(lives: number): void {
    this.livesText.setText(`x${Math.max(0, lives)}`);
  }

  private updateHealth(hp: number): void {
    this.hearts.forEach((heart, i) => heart.setFrame(i < hp ? UI_FRAME.heart : UI_FRAME.heartEmpty));
  }

  /** Energy bar and cooldown overlays are polled every frame. */
  update(): void {
    const abilities = this.level.abilities;
    if (!abilities) return;
    this.energyBar.clear();
    if (abilities.actives.length > 0 || abilities.passives.some((a) => a.def.levels[a.level - 1].energy > 0)) {
      this.energyBar.fillStyle(0x141327).fillRect(5, 25, 32, 4);
      this.energyBar.fillStyle(hex(PALETTE.glow)).fillRect(6, 26, Math.round(30 * abilities.energy.fraction), 2);
    }
    this.slots.forEach((slot, i) => {
      const ability = abilities.actives[i];
      slot.overlay.clear();
      if (!ability) return;
      const remaining = ability.cooldown.remaining;
      const starved = abilities.energy.current < ability.def.levels[ability.level - 1].energy;
      if (remaining > 0 || starved) {
        const h = starved ? slot.size : Math.ceil(slot.size * remaining);
        slot.overlay.fillStyle(0x141327, 0.65).fillRect(slot.x - slot.size / 2, slot.y + slot.size / 2 - h, slot.size, h);
      }
    });
  }

  /** Shows equipped active abilities: small icons on desktop, big touch buttons on mobile. */
  private createAbilitySlots(touch: boolean): void {
    const actives = getGameData().profile.activeSlots.map((id) => getGameData().abilities.abilities[id]).filter(Boolean);
    actives.forEach((def, i) => {
      const action: PlatformerAction = i === 0 ? 'skill1' : 'skill2';
      if (touch) {
        const x = i === 0 ? GAME_WIDTH - 72 : GAME_WIDTH - 30;
        const y = i === 0 ? GAME_HEIGHT - 26 : GAME_HEIGHT - 68;
        this.createTouchButton(x, y, action, def.icon);
        this.slots.push({ x, y, size: 28, overlay: this.add.graphics() });
      } else {
        const x = 54 + i * 20;
        this.add.rectangle(x, 10, 14, 14, 0x141327, 0.6).setStrokeStyle(1, 0xfff8ec, 0.5);
        this.add.image(x, 10, TEX.abilityIcons, def.icon);
        pixelText(this, x, 21, i === 0 ? 'J' : 'K', 0x9a86c4).setOrigin(0.5);
        this.slots.push({ x, y: 10, size: 14, overlay: this.add.graphics() });
      }
    });
  }

  private createIconButton(x: number, y: number, frame: number, onClick: () => void): Phaser.GameObjects.Image {
    const bg = this.add.rectangle(x, y, 16, 14, 0x141327, 0.5).setStrokeStyle(1, 0xfff8ec, 0.5);
    bg.setInteractive({ useHandCursor: true }).on('pointerup', onClick);
    return this.add.image(x, y, TEX.ui, frame);
  }

  private toggleMute(): void {
    this.sound.mute = !this.sound.mute;
    this.refreshMute();
  }

  private refreshMute(): void {
    this.muteIcon.setFrame(this.sound.mute ? UI_FRAME.soundOff : UI_FRAME.soundOn);
  }

  private createTouchControls(): void {
    const y = GAME_HEIGHT - 26;
    this.createTouchButton(26, y, 'left');
    this.createTouchButton(72, y, 'right');
    this.createTouchButton(GAME_WIDTH - 30, y, 'jump');
  }

  private createTouchButton(x: number, y: number, action: PlatformerAction, abilityIcon?: number): void {
    const radius = abilityIcon === undefined ? 18 : 14;
    const circle = this.add.circle(x, y, radius, 0x141327, 0.35).setStrokeStyle(1, 0xfff8ec, 0.45);
    if (abilityIcon !== undefined) {
      this.add.image(x, y, TEX.abilityIcons, abilityIcon).setScale(2);
    } else {
      const icon = this.add.graphics({ fillStyle: { color: 0xfff8ec, alpha: 0.75 } });
      if (action === 'left') icon.fillTriangle(x - 7, y, x + 5, y - 7, x + 5, y + 7);
      else if (action === 'right') icon.fillTriangle(x + 7, y, x - 5, y - 7, x - 5, y + 7);
      else icon.fillTriangle(x, y - 7, x - 7, y + 5, x + 7, y + 5);
    }

    // Track pointers individually so several fingers can hold different buttons (multi-touch).
    const pointers = new Set<number>();
    const sync = (): void => {
      const down = pointers.size > 0;
      this.level.controls.setTouch(action, down);
      circle.setFillStyle(down ? 0x4a3f8a : 0x141327, down ? 0.6 : 0.35);
    };
    const press = (p: Phaser.Input.Pointer): void => {
      pointers.add(p.id);
      sync();
    };
    const release = (p: Phaser.Input.Pointer): void => {
      if (pointers.delete(p.id)) sync();
    };

    const zone = this.add.zone(x, y, radius * 2 + 10, radius * 2 + 10).setInteractive();
    zone.on('pointerdown', press);
    zone.on('pointerover', (p: Phaser.Input.Pointer) => p.isDown && press(p));
    zone.on('pointerout', release);
    zone.on('pointerup', release);
    this.input.on('pointerup', release);
  }

  private togglePause(): void {
    if (this.paused) this.resumeGame();
    else this.pauseGame();
  }

  private pauseGame(): void {
    if (this.paused || this.ended) return;
    this.paused = true;
    this.level.controls.clearTouch();
    this.scene.pause(PlatformerScenes.Level);
    this.showOverlay('Pausa', '', [
      ['Continuar', () => this.resumeGame()],
      ['Reiniciar', () => this.restartLevel()],
      ['Niveles', () => openLevelSelect(this)],
      ['Menu', () => exitToMenu(this)],
    ]);
  }

  private resumeGame(): void {
    if (!this.paused) return;
    this.paused = false;
    this.hideOverlay();
    this.scene.resume(PlatformerScenes.Level);
  }

  private onVictory(stars: number, total: number, nextLevelId: string | null, newStars: number): void {
    this.ended = true;
    const buttons: Array<[string, () => void]> = nextLevelId
      ? [['Siguiente nivel', () => startLevel(this, nextLevelId)], ['Repetir', () => this.restartLevel()]]
      : [['Repetir', () => this.restartLevel()]];
    buttons.push(['Niveles', () => openLevelSelect(this)]);
    const wallet = getGameData().profile.balance;
    this.showOverlay(nextLevelId ? 'Nivel completado!' : 'Aventura completada!', `Estrellas ${stars}/${total}  +${newStars} nuevas  (saldo ${wallet})`, buttons);
  }

  private onGameOver(): void {
    this.ended = true;
    this.showOverlay('Sin vidas', 'Vuelve a intentarlo', [
      ['Reintentar', () => this.restartLevel()],
      ['Niveles', () => openLevelSelect(this)],
    ]);
  }

  private restartLevel(): void {
    startLevel(this, this.level.currentLevelId);
  }

  private showOverlay(title: string, subtitle: string, buttons: Array<[string, () => void]>): void {
    this.hideOverlay();
    const container = this.add.container(0, 0);
    container.add(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0c0b1c, 0.7).setOrigin(0).setInteractive());
    container.add(pixelText(this, GAME_WIDTH / 2, 42, title, hex(PALETTE.gold), 2).setOrigin(0.5));
    if (subtitle) container.add(pixelText(this, GAME_WIDTH / 2, 62, subtitle, hex(PALETTE.white)).setOrigin(0.5));
    buttons.forEach(([label, onClick], i) => container.add(createTextButton(this, GAME_WIDTH / 2, 84 + i * 22, label, onClick)));
    this.overlay = container;
    this.overlayPrimary = buttons[0]?.[1] ?? null;
  }

  private hideOverlay(): void {
    this.overlay?.destroy();
    this.overlay = null;
    this.overlayPrimary = null;
  }
}
