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
  PLAYER_MAX_HP,
  PlatformerScenes,
  START_LIVES,
  type PlatformerAction,
} from '../config';
import { Player, PlayerEvent } from '../entities/Player';
import type { Enemy } from '../entities/Enemy';
import { AbilitySystem } from '../abilities/AbilitySystem';
import { CombatSystem } from '../combat/CombatSystem';
import { Health, type Hit } from '../combat/damage';
import { getGameData } from '../progression/gameData';
import { registerAnimations } from '../../../core/animation/AnimationRegistry';
import { createMissingPlaceholders } from '../../../core/assets/AssetLoader';
import { getBiome } from '../biomes';
import type { BiomeTheme } from '../biomes/BiomeTheme';
import type { LevelSceneData } from '../level/levelFlow';
import { getCampaign, getLevelManager } from '../level/levelLoader';
import { parseLevel, type TilePoint } from '../level/LevelParser';
import { getSandboxLevel } from '../level/sandboxLevels';
import { validateBossEncounter, type BossEncounter } from '../level/BossEncounter';
import { createDefaultRegistry } from '../objects/builtin';
import { StoryDirector } from '../story/StoryDirector';
import { validateStory } from '../story/validate';
import { StoryPanel } from '../view/StoryPanel';
import { LevelObjectManager } from '../objects/LevelObjectManager';
import type { SceneHost } from '../objects/sceneHost';
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
  private combat!: CombatSystem;
  /** Equipped abilities and the energy pool; read by the HUD. */
  abilities!: AbilitySystem;
  readonly health = new Health(PLAYER_MAX_HP);
  private collectedStars: string[] = [];
  private gateMessageAt = 0;
  private objects: LevelObjectManager<SceneHost> | null = null;
  /** Technical levels (dev tools) never record stars, progress or saves. */
  private sandbox = false;
  private story: StoryDirector | null = null;
  private storyPanel: StoryPanel | null = null;
  /** True while a blocking story beat froze the physics. */
  private storyFroze = false;
  private touchDevice = false;
  private encounter: BossEncounter | null = null;
  private encounterStarted = false;
  private encounterDefeated = false;

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
    const sandboxData = getSandboxLevel(data.levelId);
    this.sandbox = !!sandboxData;
    const levelData = sandboxData ?? manager.getData(data.levelId);
    const entry = manager.get(data.levelId);
    const level = parseLevel(levelData);
    const storyCheck = validateStory(levelData.story, { width: level.width, height: level.height });
    this.encounter = validateBossEncounter(levelData.bossEncounter, level, storyCheck.beats).encounter;
    this.encounterStarted = false;
    this.encounterDefeated = false;
    const biome = getBiome(level.biome, level.variant);
    // Biome textures are generated on first use so unused biomes cost nothing.
    createMissingPlaceholders(this, biome.assets);
    registerAnimations(this.anims, biome.anims);
    this.levelId = data.levelId;
    this.levelName = this.sandbox ? levelData.name : `${getCampaign().positionOf(data.levelId) || (entry?.index ?? 0) + 1}. ${entry?.name ?? ''}`;
    this.bus = new Phaser.Events.EventEmitter();
    this.controls = new ActionInput(this, PLATFORMER_BINDINGS);
    this.stars = 0;
    this.totalStars = level.stars.length;
    this.lives = START_LIVES;
    this.finished = false;
    this.lookAhead = 0;
    this.collectedStars = [];
    this.health.reset();
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
    this.touchDevice = touch;
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
      star.setDepth(DEPTH.props).setData('glow', glow).setData('key', `${p.col},${p.row}`).play(ANIM.star).setBodySize(10, 10);
      // Visual bob only; the static body stays in place.
      this.tweens.add({ targets: star, y: y - 2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: (p.col * 97) % 900 });
    }

    const checkpoints = this.physics.add.staticGroup();
    for (const p of level.checkpoints) {
      const cp = checkpoints.create(tileCenterX(p), tileBottom(p), TEX.checkpoint, 0) as Phaser.Physics.Arcade.Sprite;
      cp.setOrigin(0.5, 1).refreshBody().setDepth(DEPTH.props);
    }

    this.respawn.set(tileCenterX(spawn), tileBottom(spawn) - 16);
    this.player = new Player(this, this.respawn.x, this.respawn.y);
    const feet = (): [number, number] => [this.player.visual.x, this.player.visual.y];
    this.player.on(PlayerEvent.Jump, () => this.fx.jump(...feet()));
    this.player.on(PlayerEvent.Land, (impact: number) => this.fx.land(...feet(), impact));
    this.player.on(PlayerEvent.Step, () => this.fx.step(this.player.visual.x - this.player.facing * 4, this.player.visual.y));

    const playerAlive = (): boolean => this.player.isAlive;
    this.physics.add.collider(this.player, layer, undefined, playerAlive);
    const { enemies: catalog, profile, chart, statuses } = getGameData();
    this.combat = new CombatSystem(
      this,
      layer,
      this.player,
      this.fx,
      {
        damagePlayer: (hit) => this.damagePlayer(hit),
        enemyKilled: (enemy) => this.onEnemyKilled(enemy),
        bossEngaged: () => !this.encounter || (this.encounterStarted && !this.encounterDefeated && !this.story?.pendingBlocking && this.player.isAlive && this.inBossArena()),
        bossHazards: (_enemy, active) => {
          if (this.encounter) this.objects?.signals.set(this.encounter.signals.hazards, active && this.player.isAlive && !this.story?.pendingBlocking);
        },
      },
      { chart, statusCatalog: statuses.effects },
    );
    for (const p of level.enemies) {
      const def = catalog.enemies[p.type];
      if (def) this.combat.spawnEnemy(def, tileCenterX(p), tileBottom(p));
    }
    this.abilities = new AbilitySystem({ scene: this, player: this.player, input: this.controls, combat: this.combat, fx: this.fx }, profile.loadout());
    // Invalid object configuration throws here with every problem listed, instead of failing silently.
    this.objects = new LevelObjectManager(createDefaultRegistry(), { scene: this, player: this.player, fx: this.fx, damagePlayer: (hit) => this.damagePlayer(hit) });
    this.objects.load(levelData.objects, { width: level.width, height: level.height, externalSignals: this.encounter ? Object.values(this.encounter.signals) : [] });
    this.story = new StoryDirector(storyCheck.beats, touch);
    this.storyPanel = new StoryPanel(this);
    this.storyFroze = false;
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
    this.time.delayedCall(900, () => this.story?.start());
    const advanceStory = (): void => this.story?.advance();
    const advanceBlocking = (): void => {
      if (this.story?.blocking) this.story.advance();
    };
    this.input.keyboard?.on('keydown-ENTER', advanceStory);
    this.input.keyboard?.on('keydown-SPACE', advanceBlocking);
    this.input.on('pointerdown', advanceBlocking);
    this.scene.launch(PlatformerScenes.Hud, { level: this } satisfies HudData);

    const camera = this.cameras.main;
    // Any interruption drops a charge in progress: no shot, no energy spent.
    const cancelCharge = (): void => this.abilities.cancelAll();
    this.events.on(Phaser.Scenes.Events.PAUSE, cancelCharge);
    this.game.events.on(Phaser.Core.Events.BLUR, cancelCharge);
    const pauseObjects = (): void => this.objects?.pause();
    const resumeObjects = (): void => this.objects?.resume();
    this.events.on(Phaser.Scenes.Events.PAUSE, pauseObjects);
    this.events.on(Phaser.Scenes.Events.RESUME, resumeObjects);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      cancelCharge();
      this.combat.suspendBosses();
      if (this.encounter) this.objects?.signals.set(this.encounter.signals.hazards, false);
      this.events.off(Phaser.Scenes.Events.PAUSE, pauseObjects);
      this.events.off(Phaser.Scenes.Events.RESUME, resumeObjects);
      this.objects?.destroy();
      this.objects = null;
      this.input.keyboard?.off('keydown-ENTER', advanceStory);
      this.input.keyboard?.off('keydown-SPACE', advanceBlocking);
      this.input.off('pointerdown', advanceBlocking);
      this.storyPanel?.destroy();
      this.storyPanel = null;
      this.story = null;
      this.events.off(Phaser.Scenes.Events.PAUSE, cancelCharge);
      this.game.events.off(Phaser.Core.Events.BLUR, cancelCharge);
      camera.off(Phaser.Cameras.Scene2D.Events.FOLLOW_UPDATE, this.onCameraMoved, this);
      this.bus.removeAllListeners();
      this.controls.destroy();
    });
  }

  update(_time: number, delta: number): void {
    this.controls.update();
    this.updateStory(delta / 1000);
    if (this.storyFroze) return;
    this.player.update(this.controls, delta);
    if (this.finished) this.abilities.cancelAll();
    else this.abilities.update(delta / 1000, this.controls);
    this.combat.update();
    if (!this.finished) this.objects?.update(delta / 1000);

    if (this.player.isAlive && Math.abs(this.player.body.velocity.x) > 20) this.lookAhead = this.player.facing * CAMERA_LOOK_AHEAD;
    const camera = this.cameras.main;
    camera.followOffset.x = Phaser.Math.Linear(camera.followOffset.x, -this.lookAhead, 1 - Math.exp(-delta / 350));

    if (this.player.isAlive && this.player.y > this.worldHeight + TILE_SIZE) this.killPlayer();
  }

  /** Advances the dialogue, freezes the action during blocking beats and fires zone beats. */
  private updateStory(dt: number): void {
    const story = this.story;
    if (!story) return;
    story.update(dt);
    if (this.encounter && !this.encounterStarted && !this.encounterDefeated && this.player.isAlive && this.inBossArena()) {
      this.encounterStarted = true;
      this.objects?.signals.set(this.encounter.signals.engaged, true);
      this.frameBossArena(true);
      story.trigger(this.encounter.intro);
    }
    this.storyPanel?.render(story.view, this.touchDevice, dt, this.player.visual.y - this.cameras.main.scrollY);
    const blocking = story.blocking;
    if (blocking !== this.storyFroze) {
      this.storyFroze = blocking;
      if (blocking) {
        this.combat.suspendBosses();
        this.physics.pause();
        this.player.body.setVelocity(0, 0);
        this.abilities.cancelAll();
      } else if (!this.finished) this.physics.resume();
    }
    if (!blocking && this.player.isAlive) {
      const b = this.player.body;
      story.checkZones({ x: b.x, y: b.y, width: b.width, height: b.height });
    }
  }

  private inBossArena(): boolean {
    const arena = this.encounter?.arena;
    return !!arena && this.player.x >= arena.col * TILE_SIZE && this.player.x < (arena.col + arena.width) * TILE_SIZE && this.player.y >= arena.row * TILE_SIZE && this.player.y < (arena.row + arena.height) * TILE_SIZE;
  }

  private frameBossArena(locked: boolean): void {
    if (!this.encounter) return;
    const camera = this.cameras.main;
    if (locked) {
      camera.stopFollow();
      camera.setBounds(this.encounter.arena.col * TILE_SIZE, 0, this.encounter.arena.width * TILE_SIZE, this.worldHeight);
      camera.setScroll(this.encounter.arena.col * TILE_SIZE, this.worldHeight - GAME_HEIGHT);
    } else {
      camera.setBounds(0, 0, this.physics.world.bounds.width, this.worldHeight);
      camera.startFollow(this.player.visual, true, CAMERA_LERP_X, CAMERA_LERP_Y, 0, CAMERA_HEIGHT_OFFSET);
    }
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

  /**
   * Every source of player damage ends here (contact, projectiles); pits kill directly. The hero has
   * no element or armor yet, so enemy hits keep their base damage (neutral defense).
   */
  private damagePlayer(hit: Hit & { fromX: number }): void {
    if (!this.player.isAlive || this.player.isInvulnerable || this.finished) return;
    if (this.encounterStarted && (this.story?.pendingBlocking || (this.combat.enemies.getChildren() as Enemy[]).some((enemy) => enemy.omega?.state === 'transition'))) return;
    const fromX = hit.fromX;
    const result = this.health.apply(hit);
    this.bus.emit(LevelEvent.Health, this.health.current, this.health.max);
    if (result.killed) {
      this.killPlayer();
      return;
    }
    playSound(this, AUDIO.hurt);
    this.cameras.main.shake(120, 0.005);
    this.player.hurt(fromX);
  }

  private onEnemyKilled(enemy: Enemy): void {
    this.abilities.energy.restore(enemy.def.reward.energy);
    if (this.encounter && enemy.def.id === this.encounter.enemy) {
      this.encounterDefeated = true;
      this.objects?.signals.set(this.encounter.signals.hazards, false);
      this.objects?.signals.set(this.encounter.signals.engaged, false);
      this.objects?.signals.set(this.encounter.signals.defeated, true);
      this.frameBossArena(false);
      this.story?.trigger(this.encounter.victory);
    }
    if (enemy.def.boss && this.combat.bossesAlive === 0) this.floatText(enemy.x, enemy.y - 40, 'Portal abierto!');
  }

  private onCollectStar(_player: OverlapTarget, other: OverlapTarget): void {
    const star = other as Phaser.Physics.Arcade.Sprite;
    (star.getData('glow') as Phaser.GameObjects.Image | undefined)?.destroy();
    this.fx.collect(star.x, star.y);
    star.disableBody(true, true);
    this.stars++;
    this.collectedStars.push(star.getData('key') as string);
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
    if (this.finished || this.story?.pendingBlocking) return;
    if (this.encounter && !this.encounterDefeated) return;
    const sprite = portal as Phaser.Physics.Arcade.Sprite;
    if (this.combat.bossesAlive > 0) {
      if (this.time.now - this.gateMessageAt > 1500) {
        this.gateMessageAt = this.time.now;
        this.floatText(sprite.x, sprite.y - 40, 'Derrota al guardian!');
      }
      return;
    }
    this.finished = true;
    this.fx.victory(sprite.x, sprite.y - 16);
    this.player.freeze();
    this.physics.pause();
    playSound(this, AUDIO.victory);
    const newStars = this.sandbox ? 0 : getGameData().profile.recordStars(this.levelId, this.collectedStars);
    const { next, chapterCompleted, unlockedChapters } = this.sandbox
      ? { next: undefined, chapterCompleted: false, unlockedChapters: [] }
      : getCampaign().complete(this.levelId, { stars: this.stars, total: this.totalStars });
    this.bus.emit(LevelEvent.Victory, this.stars, this.totalStars, next?.id ?? null, newStars, chapterCompleted, unlockedChapters.map((c) => c.name));
  }

  private killPlayer(): void {
    if (!this.player.isAlive) return;
    if (this.encounter && !this.encounterDefeated) {
      this.encounterStarted = false;
      this.frameBossArena(false);
      this.objects?.signals.set(this.encounter.signals.engaged, false);
      this.objects?.signals.set(this.encounter.signals.hazards, false);
      this.combat.suspendBosses();
    }
    this.abilities.cancelAll();
    playSound(this, AUDIO.hurt);
    this.fx.playerDeath(this.player.visual.x, this.player.visual.y - 12);
    this.cameras.main.shake(180, 0.006);
    this.player.die(() => {
      this.lives--;
      this.bus.emit(LevelEvent.Lives, this.lives);
      if (this.lives > 0) {
        if (this.encounter && !this.encounterDefeated) this.combat.suspendBosses(true);
        this.health.reset();
        this.bus.emit(LevelEvent.Health, this.health.current, this.health.max);
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
