import Phaser from 'phaser';
import { playSound } from '../../../core/audio/Sfx';
import { AUDIO, PROJECTILE_FRAME, TEX } from '../assets/manifest';
import { Enemy, type EnemyHost } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { EnemyDef } from '../enemies/EnemyCatalog';
import { DEPTH } from '../view/ParallaxBackground';
import type { PlatformerFx } from '../view/PlatformerFx';
import { beamTargets } from './beam';
import type { EffectApplication, Hit } from './damage';
import type { ElementChart } from './elements';
import type { StatusDef } from './status';

type OverlapTarget = Parameters<Phaser.Types.Physics.Arcade.ArcadePhysicsCallback>[0];

export interface CombatCallbacks {
  /** Every hit on the player: contact (form 'contact') or enemy projectiles (form 'projectile'). */
  damagePlayer(hit: Hit & { fromX: number }): void;
  enemyKilled(enemy: Enemy): void;
  bossEngaged?(enemy: Enemy): boolean;
  bossHazards?(enemy: Enemy, active: boolean): void;
}

export interface CombatRules {
  chart: ElementChart;
  statusCatalog: Readonly<Record<string, StatusDef>>;
}

export interface PlayerShot {
  x: number;
  y: number;
  vx: number;
  damage: number;
  element: string | null;
  effects?: readonly EffectApplication[];
  range: number;
}

/** Contact damage is ignored this long after a stomp, so bouncing off tough enemies is safe. */
const STOMP_GRACE_MS = 250;

/**
 * Everything that hurts something: enemies, projectiles, stomps and area attacks, all going
 * through the shared damage model (combat/damage.ts).
 */
export class CombatSystem implements EnemyHost {
  readonly enemies: Phaser.GameObjects.Group;
  private readonly playerShots: Phaser.Physics.Arcade.Group;
  private readonly enemyShots: Phaser.Physics.Arcade.Group;
  private lastStomp = -Infinity;
  readonly chart: ElementChart;
  readonly statusCatalog: Readonly<Record<string, StatusDef>>;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly terrain: Phaser.Tilemaps.TilemapLayer,
    private readonly player: Player,
    private readonly fx: PlatformerFx,
    private readonly callbacks: CombatCallbacks,
    rules: CombatRules,
  ) {
    this.chart = rules.chart;
    this.statusCatalog = rules.statusCatalog;
    this.enemies = scene.add.group({ runChildUpdate: true });
    this.playerShots = scene.physics.add.group({ allowGravity: false });
    this.enemyShots = scene.physics.add.group({ allowGravity: false });

    const physics = scene.physics.add;
    const playerAlive = (): boolean => player.isAlive;
    physics.collider(this.enemies, terrain);
    physics.collider(this.playerShots, terrain, (shot) => this.popShot(shot as Phaser.Physics.Arcade.Sprite));
    physics.collider(this.enemyShots, terrain, (shot) => this.popShot(shot as Phaser.Physics.Arcade.Sprite));
    physics.overlap(player, this.enemies, this.onPlayerTouchesEnemy, playerAlive, this);
    physics.overlap(player, this.enemyShots, this.onShotHitsPlayer, playerAlive, this);
  }

  spawnEnemy(def: EnemyDef, x: number, y: number): Enemy {
    const enemy = new Enemy(this.scene, x, y, def, this);
    this.enemies.add(enemy);
    return enemy;
  }

  get bossesAlive(): number {
    return (this.enemies.getChildren() as Enemy[]).filter((e) => e.def.boss && e.isAlive).length;
  }

  target(): { x: number; y: number; alive: boolean } {
    return { x: this.player.x, y: this.player.y, alive: this.player.isAlive };
  }

  bossEngaged(enemy: Enemy): boolean {
    return this.callbacks.bossEngaged?.(enemy) ?? true;
  }

  bossHazards(enemy: Enemy, active: boolean): void {
    this.callbacks.bossHazards?.(enemy, active);
  }

  clearBossShots(enemy: Enemy): void {
    if (!this.enemyShots.scene) return;
    for (const shot of [...this.enemyShots.getChildren()] as Phaser.Physics.Arcade.Sprite[]) {
      if (shot.getData('owner') === enemy) shot.destroy();
    }
  }

  suspendBosses(reset = false): void {
    if (!this.enemies.scene) return;
    for (const enemy of this.enemies.getChildren() as Enemy[]) enemy.suspendOmega(reset);
  }

  enemyShoot(enemy: Enemy, vx: number, vy: number, damage: number): void {
    const energy = enemy.def.attack?.projectile === 'energy';
    const shot = this.enemyShots.create(enemy.x + Math.sign(vx) * 6, enemy.y - enemy.displayHeight / 2, TEX.projectiles, energy ? PROJECTILE_FRAME.beam : PROJECTILE_FRAME.fireball) as Phaser.Physics.Arcade.Sprite;
    shot.setDepth(DEPTH.enemies).setData('damage', damage).setData('element', enemy.def.attack?.element ?? enemy.def.element).setData('startX', shot.x).setData('range', 400);
    shot.setData('owner', enemy);
    shot.play(energy ? 'platformer.projectile.beam' : 'platformer.projectile.fireball');
    if (energy) shot.setTint(0x7fe3ff);
    shot.body!.setSize(6, 6);
    shot.setVelocity(vx, vy);
    playSound(this.scene, AUDIO.enemyShoot);
  }

  enemyDied(enemy: Enemy): void {
    this.fx.enemyDefeated(enemy.x, enemy.y - enemy.displayHeight / 2);
    this.callbacks.enemyKilled(enemy);
  }

  firePlayerShot(shot: PlayerShot): void {
    const sprite = this.playerShots.create(shot.x, shot.y, TEX.projectiles, PROJECTILE_FRAME.beam) as Phaser.Physics.Arcade.Sprite;
    sprite.setDepth(DEPTH.particles).setFlipX(shot.vx < 0).setBlendMode(Phaser.BlendModes.ADD);
    const hit: Hit = { amount: shot.damage, form: 'projectile', element: shot.element, effects: shot.effects };
    sprite.setData('hit', hit).setData('startX', shot.x).setData('range', shot.range);
    sprite.play('platformer.projectile.beam');
    sprite.body!.setSize(8, 8);
    sprite.setVelocityX(shot.vx);
  }

  /**
   * Instant horizontal beam: stops at solid terrain and damages up to `pierce` enemies, nearest first.
   * Every enemy goes through applyHit, so affinities, resistances, guard and armor apply.
   */
  fireBeam(beam: { x: number; y: number; dir: -1 | 1; range: number; height: number; pierce: number; hit: Hit }): { endX: number; hits: number } {
    let endX = beam.x;
    for (let d = 0; d < beam.range; d += 4) {
      const tile = this.terrain.getTileAtWorldXY(beam.x + beam.dir * (d + 4), beam.y);
      if (tile && (tile.collideLeft || tile.collideRight)) break;
      endX = beam.x + beam.dir * Math.min(d + 4, beam.range);
    }
    const area = new Phaser.Geom.Rectangle(Math.min(beam.x, endX), beam.y - beam.height / 2, Math.abs(endX - beam.x), beam.height);
    const inBeam = (this.enemies.getChildren() as Enemy[]).filter((e) => e.isAlive && Phaser.Geom.Intersects.RectangleToRectangle(area, new Phaser.Geom.Rectangle(e.body.x, e.body.y, e.body.width, e.body.height)));
    const targets = beamTargets(beam.x, inBeam, beam.pierce);
    for (const enemy of targets) {
      const result = enemy.applyHit({ ...beam.hit, fromX: beam.x });
      this.fx.impact(enemy.x, beam.y, 'beam');
      playSound(this.scene, result.damage > 0 ? AUDIO.enemyHit : AUDIO.clank);
    }
    return { endX, hits: targets.length };
  }

  /** Damages every live enemy overlapping the area (used by melee/area abilities). Returns enemies hit. */
  damageArea(area: Phaser.Geom.Rectangle, hit: Hit): number {
    let hits = 0;
    for (const enemy of this.enemies.getChildren() as Enemy[]) {
      if (!enemy.isAlive) continue;
      const b = enemy.body;
      if (Phaser.Geom.Intersects.RectangleToRectangle(area, new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height))) {
        if (enemy.applyHit(hit).damage > 0) hits++;
      }
    }
    return hits;
  }

  update(): void {
    if (!this.player.isAlive) this.enemyShots.clear(true, true);
    // Arcade's group-vs-group overlap misses PhysicsGroup vs plain Group, so shots are tested one by one.
    for (const shot of [...this.playerShots.getChildren()] as Phaser.Physics.Arcade.Sprite[]) {
      if (shot.active) this.scene.physics.overlap(shot, this.enemies, this.onShotHitsEnemy, undefined, this);
    }
    for (const group of [this.playerShots, this.enemyShots]) {
      for (const shot of [...group.getChildren()] as Phaser.Physics.Arcade.Sprite[]) {
        if (Math.abs(shot.x - (shot.getData('startX') as number)) > (shot.getData('range') as number)) this.popShot(shot);
      }
    }
  }

  private popShot(shot: Phaser.Physics.Arcade.Sprite): void {
    this.fx.impact(shot.x, shot.y, shot.getData('hit') ? 'beam' : 'fire');
    shot.destroy();
  }

  private onPlayerTouchesEnemy(_player: OverlapTarget, other: OverlapTarget): void {
    const enemy = other as Enemy;
    if (!enemy.isAlive) return;
    const body = this.player.body;
    if (body.velocity.y > 0 && body.bottom <= enemy.body.top + 6) {
      this.player.bounce();
      this.lastStomp = this.scene.time.now;
      this.scene.cameras.main.shake(80, 0.003);
      const rule = enemy.def.stomp;
      if (rule === 'kill') {
        enemy.kill();
        playSound(this.scene, AUDIO.stomp);
      } else if (rule === 'damage') {
        enemy.applyHit({ amount: enemy.def.stompDamage, form: 'stomp', fromX: this.player.x });
        playSound(this.scene, AUDIO.enemyHit);
      } else {
        this.fx.impact(this.player.x, body.bottom, 'beam');
        playSound(this.scene, AUDIO.clank);
      }
      return;
    }
    if (this.scene.time.now - this.lastStomp < STOMP_GRACE_MS) return;
    if (!enemy.contactActive) return;
    if (!this.player.isInvulnerable && enemy.def.contactDamage > 0) {
      this.callbacks.damagePlayer({ amount: enemy.def.contactDamage, form: 'contact', element: enemy.def.element, fromX: enemy.x });
    }
  }

  private onShotHitsEnemy(shotObj: OverlapTarget, enemyObj: OverlapTarget): void {
    const shot = shotObj as Phaser.Physics.Arcade.Sprite;
    const enemy = enemyObj as Enemy;
    if (!enemy.isAlive || !shot.active) return;
    const hit = shot.getData('hit') as Hit;
    const result = enemy.applyHit({ ...hit, fromX: shot.x });
    playSound(this.scene, result.damage > 0 ? AUDIO.enemyHit : AUDIO.clank);
    this.popShot(shot);
  }

  private onShotHitsPlayer(_player: OverlapTarget, shotObj: OverlapTarget): void {
    const shot = shotObj as Phaser.Physics.Arcade.Sprite;
    if (!shot.active) return;
    if (!this.player.isInvulnerable) {
      this.callbacks.damagePlayer({ amount: shot.getData('damage') as number, form: 'projectile', element: shot.getData('element') as string | null, fromX: shot.x });
    }
    this.popShot(shot);
  }
}
