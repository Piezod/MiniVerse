import Phaser from 'phaser';
import { playSound } from '../../../core/audio/Sfx';
import { GAME_HEIGHT, GAME_WIDTH } from '../../../core/config';
import { ActionInput } from '../../../core/input/ActionInput';
import { pixelText } from '../../../core/ui/pixelFont';
import { ANIM } from '../assets/animations';
import { AUDIO, TEX } from '../assets/manifest';
import { hex, PALETTE } from '../assets/palette';
import {
  GRAVITY,
  LevelEvent,
  PLATFORMER_BINDINGS,
  PlatformerScenes,
  START_LIVES,
  type PlatformerAction,
} from '../config';
import { Player, PlayerEvent } from '../entities/Player';
import { Walker } from '../entities/Walker';
import { registerAnimations } from '../../../core/animation/AnimationRegistry';
import { createMissingPlaceholders } from '../../../core/assets/AssetLoader';
import { getBiome } from '../biomes';
import type { BiomeTheme } from '../biomes/BiomeTheme';
import type { LevelSceneData } from '../level/levelFlow';
import { getLevelManager } from '../level/levelLoader';
import { parseLevel, type TilePoint } from '../level/LevelParser';
import { autotile, isOneWayTile, isSolidTile, TILE_SIZE, type Terrain } from '../level/tileset';
import { placeDecorations } from '../view/Decorations';
import { DEPTH, ParallaxBackground } from '../view/ParallaxBackground';
import { PlatformerFx } from '../view/PlatformerFx';
import type { HudData } from './PlatformerHudScene';

type OverlapTarget = Parameters<Phaser.Types.Physics.Arcade.ArcadePhysicsCallback>[0];

const tileCenterX = (p: TilePoint): number => p.col * TILE_SIZE + TILE_SIZE / 2;
const tileBottom = (p: TilePoint): number => (p.row + 1) * TILE_SIZE;

const CAMERA_LERP_X = 0.1;
const CAMERA_LERP_Y = 0.12;
const CAMERA_LOOK_AHEAD = 28;
/** Keeps the camera centred on the character's chest rather than its feet. */
const CAMERA_HEIGHT_OFFSET = 18;

export class PlatformerLevelScene extends Phaser.Scene {
  static readonly KEY = PlatformerScenes.Level;

  /** Shared with the HUD scene, which feeds touch input into it. */
  controls!: ActionInput<PlatformerAction>;
  /** Level → HUD events (see LevelEvent). Recreated on every (re)start. */
  bus!: Phaser.Events.EventEmitter;

  private player!: Player;
  private parallax!: ParallaxBackground;
  private fx!: PlatformerFx;
  private readonly respawn = new Phaser.Math.Vector2();
  private worldHeight = 0;
  private lookAhead = 0;
  private stars = 0;
  private totalStars = 0;
  private lives = START_LIVES;
  private finished = false;
  private levelId = '';
  private levelName = '';

  constructor() {
    super({ key: PlatformerLevelScene.KEY, physics: { arcade: { gravity: { x: 0, y: GRAVITY } } } });
  }

  get starCount(): number {
    return this.stars;
  }

  get starTotal(): number {
    return this.totalStars;
  }

  get livesLeft(): number {
    return this.lives;
  }

  get currentLevelId(): string {
    return this.levelId;
  }

  create(data: LevelSceneData): void {
    const manager = getLevelManager();
    const entry = manager.get(data.levelId);
    const level = parseLevel(manager.getData(data.levelId));
    const biome = getBiome(level.biome);
    // Biome textures are generated on first use so unused biomes cost nothing.
    createMissingPlaceholders(this, biome.assets);
    registerAnimations(this.anims, biome.anims);
    this.levelId = data.levelId;
    this.levelName = `${(entry?.index ?? 0) + 1}. ${entry?.name ?? ''}`;
    this.bus = new Phaser.Events.EventEmitter();
    this.controls = new ActionInput(this, PLATFORMER_BINDINGS);
    this.stars = 0;
    this.totalStars = level.stars.length;
    this.lives = START_LIVES;
    this.finished = false;
    this.lookAhead = 0;
    this.physics.resume();

    const { map, layer } = this.createTerrain(level.terrain, biome);
    this.worldHeight = map.heightInPixels;
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.physics.world.setBoundsCollision(true, true, false, false);

    this.parallax = new ParallaxBackground(this, biome.parallax, Math.max(0, map.heightInPixels - GAME_HEIGHT));
    this.fx = new PlatformerFx(this, biome);
    const portalTiles = level.portals.flatMap((p) => [-1, 0, 1].map((d) => ({ col: p.col + d, row: p.row })));
    const spawn = level.spawn!;
    placeDecorations(this, level, biome, [spawn, ...level.checkpoints, ...level.signs, ...portalTiles]);

    const touch = this.sys.game.device.input.touch;
    for (const sign of level.signs) {
      const x = tileCenterX(sign);
      const y = tileBottom(sign);
      this.add.image(x, y, biome.decorations, biome.signFrame).setOrigin(0.5, 1).setDepth(DEPTH.props);
      pixelText(this, x, y - 18, touch ? sign.text.touch : sign.text.keyboard, hex(PALETTE.goldLight))
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.props);
    }

    const stars = this.physics.add.staticGroup();
    for (const p of level.stars) {
      const x = tileCenterX(p);
      const y = tileBottom(p) - TILE_SIZE / 2;
      const glow = this.addGlow(x, y, hex(PALETTE.gold), 0.6, 0.25);
      const star = stars.create(x, y, TEX.star) as Phaser.Physics.Arcade.Sprite;
      star.setDepth(DEPTH.props).setData('glow', glow).play(ANIM.star).setBodySize(10, 10);
      // Visual bob only; the static body stays in place.
      this.tweens.add({ targets: star, y: y - 2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: (p.col * 97) % 900 });
    }

    const checkpoints = this.physics.add.staticGroup();
    for (const p of level.checkpoints) {
      const cp = checkpoints.create(tileCenterX(p), tileBottom(p), TEX.checkpoint, 0) as Phaser.Physics.Arcade.Sprite;
      cp.setOrigin(0.5, 1).refreshBody().setDepth(DEPTH.props);
    }

    const enemies = this.add.group({ runChildUpdate: true });
    for (const p of level.enemies) enemies.add(new Walker(this, tileCenterX(p), tileBottom(p) - 8, layer));

    this.respawn.set(tileCenterX(spawn), tileBottom(spawn) - 16);
    this.player = new Player(this, this.respawn.x, this.respawn.y);
    const feet = (): [number, number] => [this.player.visual.x, this.player.visual.y];
    this.player.on(PlayerEvent.Jump, () => this.fx.jump(...feet()));
    this.player.on(PlayerEvent.Land, (impact: number) => this.fx.land(...feet(), impact));
    this.player.on(PlayerEvent.Step, () => this.fx.step(this.player.visual.x - this.player.facing * 4, this.player.visual.y));

    const playerAlive = (): boolean => this.player.isAlive;
    this.physics.add.collider(this.player, layer, undefined, playerAlive);
    this.physics.add.collider(enemies, layer);
    this.physics.add.overlap(this.player, enemies, this.onPlayerTouchesEnemy, playerAlive, this);
    this.physics.add.overlap(this.player, stars, this.onCollectStar, playerAlive, this);
    this.physics.add.overlap(this.player, checkpoints, this.onCheckpoint, playerAlive, this);

    for (const p of level.portals) {
      const x = tileCenterX(p);
      const y = tileBottom(p);
      this.addGlow(x, y - 16, hex(PALETTE.voidLight), 2.2, 0.5);
      const portal = this.physics.add.staticSprite(x, y, TEX.portal).setOrigin(0.5, 1).refreshBody().setDepth(DEPTH.props);
      portal.play(ANIM.portal);
      this.physics.add.overlap(this.player, portal, this.onReachPortal, playerAlive, this);
    }

    this.setupCamera(map, biome);
    this.showTitle();
    this.scene.launch(PlatformerScenes.Hud, { level: this } satisfies HudData);

    const camera = this.cameras.main;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      camera.off(Phaser.Cameras.Scene2D.Events.FOLLOW_UPDATE, this.onCameraMoved, this);
      this.bus.removeAllListeners();
      this.controls.destroy();
    });
  }

  update(_time: number, delta: number): void {
    this.controls.update();
    this.player.update(this.controls, delta);

    if (this.player.isAlive && Math.abs(this.player.body.velocity.x) > 20) this.lookAhead = this.player.facing * CAMERA_LOOK_AHEAD;
    const camera = this.cameras.main;
    camera.followOffset.x = Phaser.Math.Linear(camera.followOffset.x, -this.lookAhead, 1 - Math.exp(-delta / 350));

    if (this.player.isAlive && this.player.y > this.worldHeight + TILE_SIZE) this.killPlayer();
  }

  private setupCamera(map: Phaser.Tilemaps.Tilemap, biome: BiomeTheme): void {
    const camera = this.cameras.main;
    camera.setBackgroundColor(biome.backgroundColor);
    camera.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    camera.startFollow(this.player.visual, true, CAMERA_LERP_X, CAMERA_LERP_Y, 0, CAMERA_HEIGHT_OFFSET);
    // Parallax must use the camera position of the frame being rendered, not the previous one.
    camera.on(Phaser.Cameras.Scene2D.Events.FOLLOW_UPDATE, this.onCameraMoved, this);
    const { vignette, overlay } = biome.lighting;
    if (this.renderer.type === Phaser.WEBGL) camera.postFX.addVignette(0.5, 0.5, 0.9, vignette);
    if (overlay) {
      this.add
        .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, overlay.color, overlay.alpha)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(DEPTH.foreground + 1)
        .setBlendMode(overlay.blend === 'add' ? Phaser.BlendModes.ADD : Phaser.BlendModes.MULTIPLY);
    }
    camera.fadeIn(400, 20, 19, 39);
    this.onCameraMoved();
  }

  private showTitle(): void {
    const title = pixelText(this, GAME_WIDTH / 2, 46, this.levelName, hex(PALETTE.goldLight), 2)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.foreground + 2)
      .setAlpha(0);
    this.tweens.chain({
      targets: title,
      tweens: [
        { alpha: 1, y: 40, duration: 400, ease: 'Quad.easeOut' },
        { alpha: 0, duration: 500, delay: 1400, onComplete: () => title.destroy() },
      ],
    });
  }

  private onCameraMoved(): void {
    const camera = this.cameras.main;
    this.parallax.update(camera);
    this.fx.update(camera);
  }

  private createTerrain(terrain: Terrain[][], biome: BiomeTheme): { map: Phaser.Tilemaps.Tilemap; layer: Phaser.Tilemaps.TilemapLayer } {
    const map = this.make.tilemap({ data: autotile(terrain), tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage(biome.tileset, biome.tileset, TILE_SIZE, TILE_SIZE);
    const layer = tileset ? map.createLayer(0, tileset, 0, 0) : null;
    if (!layer) throw new Error('Could not build the level tilemap');

    layer.setDepth(DEPTH.terrain);
    layer.forEachTile((tile) => {
      if (isSolidTile(tile.index)) tile.setCollision(true, true, true, true, false);
      else if (isOneWayTile(tile.index)) tile.setCollision(false, false, true, false, false);
    });
    layer.calculateFacesWithin();
    return { map, layer };
  }

  private addGlow(x: number, y: number, tint: number, scale: number, alpha: number): Phaser.GameObjects.Image {
    const glow = this.add.image(x, y, TEX.glow).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setScale(scale).setAlpha(alpha).setDepth(DEPTH.decorBack);
    this.tweens.add({ targets: glow, alpha: alpha * 1.6, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return glow;
  }

  private onPlayerTouchesEnemy(_player: OverlapTarget, other: OverlapTarget): void {
    const enemy = other as Walker;
    if (!enemy.isAlive) return;
    const body = this.player.body;
    if (body.velocity.y > 0 && body.bottom <= enemy.body.top + 6) {
      enemy.stomp();
      this.player.bounce();
      this.fx.enemyDefeated(enemy.x, enemy.y);
      this.cameras.main.shake(90, 0.004);
      playSound(this, AUDIO.stomp);
    } else if (!this.player.isInvulnerable) {
      this.killPlayer();
    }
  }

  private onCollectStar(_player: OverlapTarget, other: OverlapTarget): void {
    const star = other as Phaser.Physics.Arcade.Sprite;
    (star.getData('glow') as Phaser.GameObjects.Image | undefined)?.destroy();
    this.fx.collect(star.x, star.y);
    star.disableBody(true, true);
    this.stars++;
    playSound(this, AUDIO.star);
    this.bus.emit(LevelEvent.Stars, this.stars, this.totalStars);
  }

  private onCheckpoint(_player: OverlapTarget, other: OverlapTarget): void {
    const cp = other as Phaser.Physics.Arcade.Sprite;
    if (cp.getData('active')) return;
    cp.setData('active', true).setFrame(1);
    this.addGlow(cp.x, cp.y - 24, hex(PALETTE.glow), 1.2, 0.45);
    this.fx.checkpoint(cp.x, cp.y - 24);
    this.respawn.set(cp.x, cp.y - 16);
    playSound(this, AUDIO.checkpoint);
    this.floatText(cp.x, cp.y - 40, 'Punto de control!');
  }

  private onReachPortal(_player: OverlapTarget, portal: OverlapTarget): void {
    if (this.finished) return;
    this.finished = true;
    const sprite = portal as Phaser.Physics.Arcade.Sprite;
    this.fx.victory(sprite.x, sprite.y - 16);
    this.player.freeze();
    this.physics.pause();
    playSound(this, AUDIO.victory);
    const next = getLevelManager().complete(this.levelId, { stars: this.stars, total: this.totalStars });
    this.bus.emit(LevelEvent.Victory, this.stars, this.totalStars, next?.id ?? null);
  }

  private killPlayer(): void {
    if (!this.player.isAlive) return;
    playSound(this, AUDIO.hurt);
    this.fx.playerDeath(this.player.visual.x, this.player.visual.y - 12);
    this.cameras.main.shake(180, 0.006);
    this.player.die(() => {
      this.lives--;
      this.bus.emit(LevelEvent.Lives, this.lives);
      if (this.lives > 0) {
        this.player.respawnAt(this.respawn.x, this.respawn.y);
        this.fx.land(this.player.visual.x, this.player.visual.y, 200);
      } else {
        this.finished = true;
        this.bus.emit(LevelEvent.GameOver);
      }
    });
  }

  private floatText(x: number, y: number, message: string): void {
    const text = pixelText(this, x, y, message, hex(PALETTE.glow)).setOrigin(0.5).setDepth(DEPTH.foreground);
    this.tweens.add({ targets: text, y: y - 12, alpha: 0, duration: 1400, ease: 'Quad.easeOut', onComplete: () => text.destroy() });
  }
}
