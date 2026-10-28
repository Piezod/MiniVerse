import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => {
  const { EventEmitter } = await import('node:events');
  class Sprite extends EventEmitter {
    active = true;
    flipX = false;
    displayHeight = 24;
    displayWidth = 24;
    tint = 0;
    animation = '';
    body = {
      velocity: { x: 0, y: 0 }, blocked: { left: false, right: false, down: true },
      enable: true, allowGravity: true, immovable: false, left: 90, right: 110, bottom: 100,
      setSize: vi.fn().mockReturnThis(), setOffset: vi.fn().mockReturnThis(),
      setAllowGravity: (value: boolean) => { this.body.allowGravity = value; },
      setImmovable: (value: boolean) => { this.body.immovable = value; },
      setVelocityX: (value: number) => { this.body.velocity.x = value; },
      setVelocityY: (value: number) => { this.body.velocity.y = value; },
      setVelocity: (vx: number, vy: number) => { this.body.velocity = { x: vx, y: vy }; },
      stop: () => { this.body.velocity = { x: 0, y: 0 }; },
      reset: (x: number, y: number) => { this.x = x; this.y = y; },
    };
    anims = { isPaused: false, pause: () => { this.anims.isPaused = true; }, resume: () => { this.anims.isPaused = false; } };
    constructor(readonly scene: unknown, public x: number, public y: number) { super(); }
    setScale() { return this; }
    setOrigin() { return this; }
    setCollideWorldBounds() { return this; }
    setDepth() { return this; }
    setTint(value: number) { this.tint = value; return this; }
    setTintFill(value: number) { this.tint = value; return this; }
    clearTint() { this.tint = 0; return this; }
    setFlipX(value: boolean) { this.flipX = value; return this; }
    play(key: string) { this.animation = key; return this; }
    destroy() { if (this.active) { this.active = false; this.emit('destroy'); } }
  }
  class Rectangle {
    constructor(public x: number, public y: number, public width: number, public height: number) {}
  }
  return { default: {
    Geom: { Rectangle, Intersects: { RectangleToRectangle: (first: Rectangle, second: Rectangle) => first.x < second.x + second.width && first.x + first.width > second.x && first.y < second.y + second.height && first.y + first.height > second.y } },
    Physics: { Arcade: { Sprite } }, GameObjects: { Events: { DESTROY: 'destroy' } },
    Math: { Distance: { Between: (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by) }, Angle: { Between: (ax: number, ay: number, bx: number, by: number) => Math.atan2(by - ay, bx - ax) } },
  } };
});

import { Enemy, type EnemyHost } from '../src/games/platformer/entities/Enemy';
import { buildCatalogs } from '../src/games/platformer/progression/gameData';
import { ENEMY_ANIMS } from '../src/games/platformer/assets/enemySprites';
import { hoverPatrol, leashedChase } from '../src/games/platformer/enemies/flight';
import { EnergyPool } from '../src/games/platformer/combat/resources';
import { CombatSystem } from '../src/games/platformer/combat/CombatSystem';
import { TEX } from '../src/games/platformer/assets/manifest';

const assets = join(__dirname, '../public/assets/platformer');
const json = (file: string): unknown => JSON.parse(readFileSync(join(assets, file), 'utf8'));
const catalogs = buildCatalogs({ elements: json('combat/elements.json'), statuses: json('combat/status-effects.json'), enemies: json('enemies/enemies.json'), abilities: json('abilities/abilities.json') });

function setup(id = 'auto-turret', targetX = 40) {
  const target = { x: targetX, y: 90, alive: true };
  const timers: Array<{ remove: ReturnType<typeof vi.fn>; callback: () => void }> = [];
  const tweens: Array<{ stop: ReturnType<typeof vi.fn>; onComplete: () => void }> = [];
  const bars: Array<{ destroy: ReturnType<typeof vi.fn> }> = [];
  const bossNodesActive = vi.fn(() => false);
  const bossNodesReset = vi.fn();
  const bossSupport = vi.fn();
  const scene = {
    add: { existing: vi.fn(), graphics: () => {
      const bar = { destroy: vi.fn(), clear: vi.fn(), setDepth: () => bar, setScrollFactor: () => bar, fillStyle: () => bar, fillRect: () => bar };
      bars.push(bar);
      return bar;
    } },
    physics: { add: { existing: vi.fn() } },
    time: { now: 0, delayedCall: (_delay: number, callback: () => void) => {
      const timer = { remove: vi.fn(), callback };
      timers.push(timer);
      return timer;
    } },
    tweens: { add: (config: { onComplete: () => void }) => {
      const tween = { stop: vi.fn(), onComplete: config.onComplete };
      tweens.push(tween);
      return tween;
    } },
  };
  const host: EnemyHost = {
    chart: catalogs.chart, statusCatalog: catalogs.statuses.effects,
    terrain: { getTileAtWorldXY: () => ({ collideUp: true }) } as unknown as EnemyHost['terrain'],
    target: () => target, enemyShoot: vi.fn(), enemyDied: vi.fn(),
    bossEngaged: vi.fn(() => target.alive), bossHazards: vi.fn(), bossNodesActive, bossNodesReset, bossSupport, clearBossShots: vi.fn(),
  };
  const enemy = new Enemy(scene as unknown as ConstructorParameters<typeof Enemy>[0], 100, 100, catalogs.enemies.enemies[id], host);
  return { enemy, host, target, timers, tweens, bars, scene, bossNodesActive, bossNodesReset, bossSupport };
}

describe('Enemy: catálogo y comportamientos compartidos', () => {
  it('la Reina usa la barra/daño comunes, bloquea sin nodos y limpia fase/apoyos al morir', () => {
    expect(catalogs.enemies.issues).toEqual([]);
    const { enemy, host, bossNodesActive, bossNodesReset, bossSupport } = setup('swarm-queen');
    expect(enemy.def).toMatchObject({ boss: true, healthBar: true, maxHealth: 32, sprite: 'swarm-queen' });
    expect(enemy.swarmQueen).not.toBeNull();
    expect(enemy.applyHit({ amount: 1, form: 'projectile', element: 'energy' })).toMatchObject({ damage: 0, immune: true });

    enemy.update(0, 100);
    for (let frame = 0; frame < 14; frame++) enemy.update(0, 100);
    expect(enemy.swarmQueen?.state).toBe('telegraph');
    for (let frame = 0; frame < 11; frame++) enemy.update(0, 100);
    expect(host.enemyShoot).toHaveBeenCalled();
    for (let frame = 0; frame < 3; frame++) enemy.update(0, 100);
    expect(enemy.swarmQueenVulnerable).toBe(true);
    enemy.applyHit({ amount: 10, form: 'projectile', element: 'energy' });
    expect(enemy.health.fraction).toBeCloseTo(22 / 32);
    expect(enemy.swarmQueen?.phase).toBe(2);
    expect(enemy.swarmQueenProtected).toBe(true);
    expect(enemy.applyHit({ amount: 2, form: 'projectile', element: 'energy' })).toMatchObject({ damage: 0, immune: true });
    expect(enemy.health.current).toBe(22);
    expect(bossNodesReset).toHaveBeenCalled();
    for (let frame = 0; frame < 800 && bossSupport.mock.calls.length < 2; frame++) enemy.update(0, 100);
    expect(bossSupport).toHaveBeenCalledTimes(2);
    bossNodesActive.mockReturnValue(true);
    for (let frame = 0; frame < 600 && !enemy.swarmQueenVulnerable; frame++) enemy.update(0, 100);
    expect(enemy.swarmQueenVulnerable).toBe(true);
    bossNodesActive.mockReturnValue(false);
    enemy.applyHit({ amount: 12, form: 'projectile', element: 'energy' });
    expect(enemy.swarmQueen?.phase).toBe(3);
    expect(enemy.swarmQueenProtected).toBe(true);
    expect(enemy.applyHit({ amount: 2, form: 'projectile', element: 'energy' })).toMatchObject({ damage: 0, immune: true });
    for (let frame = 0; frame < 1000 && bossSupport.mock.calls.length < 4; frame++) enemy.update(0, 100);
    expect(bossSupport).toHaveBeenCalledTimes(4);
    bossNodesActive.mockReturnValue(true);
    for (let frame = 0; frame < 600 && !enemy.swarmQueenVulnerable; frame++) enemy.update(0, 100);
    expect(enemy.swarmQueenVulnerable).toBe(true);
    enemy.applyHit({ amount: 99, form: 'projectile', element: 'energy' });
    expect(enemy.isAlive).toBe(false);
    expect(enemy.swarmQueen?.state).toBe('dead');
    expect(host.bossHazards).toHaveBeenLastCalledWith(enemy, false);
    expect(host.clearBossShots).toHaveBeenCalledWith(enemy);
    expect(bossNodesReset).toHaveBeenCalledTimes(3);
  });

  it('el checkpoint reinicia salud/fase de la Reina y restablece nodos y apoyos', () => {
    const { enemy, host, bossNodesReset } = setup('swarm-queen');
    enemy.applyHit({ amount: 10, form: 'projectile', element: 'energy' });
    enemy.x = 150;
    enemy.suspendBoss(true);
    expect(enemy.health.current).toBe(32);
    expect(enemy.swarmQueen).toMatchObject({ phase: 1, state: 'dormant' });
    expect(enemy.x).toBe(100);
    expect(bossNodesReset).toHaveBeenCalledOnce();
    expect(host.bossHazards).toHaveBeenLastCalledWith(enemy, false);
    expect(host.clearBossShots).toHaveBeenCalledWith(enemy);
  });

  it('limita el apoyo de Reina a cuatro enemigos vivos y lo limpia al suspender', () => {
    const support: Array<{ active: boolean; isAlive: boolean; kill: ReturnType<typeof vi.fn>; once: ReturnType<typeof vi.fn> }> = [];
    const spawnEnemy = vi.fn(() => {
      const enemy = { active: true, isAlive: true, kill: vi.fn(), once: vi.fn() };
      support.push(enemy);
      return enemy;
    });
    const combat = Object.assign(Object.create(CombatSystem.prototype) as object, { supportEnemies: new Set(), spawnEnemy }) as unknown as CombatSystem;
    const queen = { x: 100, y: 80 } as Enemy;
    for (let count = 0; count < 8; count++) combat.spawnQueenSupport(queen, [catalogs.enemies.enemies.stalker, catalogs.enemies.enemies['nexar-bat']]);
    expect(spawnEnemy).toHaveBeenCalledTimes(4);
    combat.clearBossSupport();
    expect(support.every((enemy) => enemy.kill.mock.calls.length === 1)).toBe(true);
  });

  it('el Acechador detecta, anticipa y carga; queda expuesto al fallar y limpia al morir', () => {
    const { enemy, host, target } = setup('stalker', 65);
    expect(enemy.def).toMatchObject({ movement: 'chase', detectRange: 124, sprite: 'stalker' });
    enemy.update(0, 16);
    expect(enemy.aiState).toBe('attack');
    expect(enemy.body.velocity.x).toBe(0);
    expect(enemy.def.attack?.telegraph).toBe(0.75);
    target.x = 135;
    enemy.update(0, 750);
    expect(enemy.body.velocity.x).toBe(-176);
    enemy.update(0, 400);
    expect(enemy.aiState).toBe('recover');
    expect(enemy.applyHit({ amount: 1, form: 'projectile', element: 'fire', fromX: 40 }).damage).toBeGreaterThan(0);
    enemy.applyHit({ amount: 99, form: 'projectile', element: 'energy', fromX: 40 });
    expect(enemy.isAlive).toBe(false);
    expect(enemy.body.enable).toBe(false);
    expect(host.enemyDied).toHaveBeenCalledOnce();
    expect(host.clearBossShots).toHaveBeenCalledWith(enemy);
  });

  it('el Escupidor avisa, lanza tres esporas y descansa antes de volver a atacar', () => {
    const { enemy, host } = setup('spore-spitter');
    expect(enemy.def).toMatchObject({ movement: 'stationary', fixedFacing: true, sprite: 'spore-spitter' });
    expect(enemy.def.attack).toMatchObject({ projectile: 'spore', element: 'plasma', burstCount: 3, burstInterval: 0.25, recovery: 1.25 });
    enemy.update(0, 16);
    expect(enemy.aiState).toBe('attack');
    expect(host.enemyShoot).not.toHaveBeenCalled();
    enemy.update(0, 780);
    expect(host.enemyShoot).not.toHaveBeenCalled();
    enemy.update(0, 5);
    expect(host.enemyShoot).toHaveBeenCalledTimes(1);
    enemy.update(0, 250);
    expect(host.enemyShoot).toHaveBeenCalledTimes(2);
    enemy.update(0, 250);
    expect(host.enemyShoot).toHaveBeenCalledTimes(3);
    enemy.update(0, 1);
    expect(enemy.aiState).toBe('recover');
    expect(enemy.body.immovable).toBe(true);
    enemy.applyHit({ amount: 99, form: 'projectile', element: 'energy' });
    expect(enemy.isAlive).toBe(false);
    expect(host.enemyDied).toHaveBeenCalledOnce();
    expect(host.clearBossShots).toHaveBeenCalledWith(enemy);
  });

  it('CombatSystem crea el proyectil de espora con arte y animacion propios', () => {
    const { enemy } = setup('spore-spitter');
    const projectile = {
      body: { setSize: vi.fn() },
      setDepth: vi.fn().mockReturnThis(), setData: vi.fn().mockReturnThis(),
      play: vi.fn(), setVelocity: vi.fn(),
    };
    const create = vi.fn(() => projectile);
    const combat = Object.assign(Object.create(CombatSystem.prototype) as object, {
      enemyShots: { create }, scene: { sound: { mute: true } },
    }) as unknown as CombatSystem;
    combat.enemyShoot(enemy, -96, 0, 1);
    expect(create).toHaveBeenCalledWith(94, 88, TEX.spore, 0);
    expect(projectile.play).toHaveBeenCalledWith('platformer.projectile.spore');
    expect(projectile.body.setSize).toHaveBeenCalledWith(6, 6);
    expect(projectile.setVelocity).toHaveBeenCalledWith(-96, 0);
    expect(projectile.setData).toHaveBeenCalledWith('element', 'plasma');
  });

  it('el Murcielago NEXAR patrulla acotado y fija el objetivo antes de picar', () => {
    const patrol = setup('nexar-bat', 900);
    expect(patrol.enemy.body.allowGravity).toBe(false);
    patrol.enemy.update(0, 16);
    expect(patrol.enemy.aiState).toBe('patrol');
    patrol.enemy.x = 130;
    patrol.enemy.update(0, 16);
    expect(patrol.enemy.body.velocity.x).toBe(-32);

    const dive = setup('nexar-bat', 65);
    expect(dive.enemy.def).toMatchObject({ movement: 'hover', sprite: 'nexar-bat', patrol: { range: 28, leash: 32, standoff: 72 } });
    dive.enemy.update(0, 16);
    expect(dive.enemy.aiState).toBe('attack');
    expect(dive.enemy.body.velocity.x).toBe(0);
    dive.target.x = 135;
    dive.enemy.update(0, 700);
    expect(Math.hypot(dive.enemy.body.velocity.x, dive.enemy.body.velocity.y)).toBeCloseTo(148);
    expect(dive.enemy.body.velocity.x).toBeLessThan(0);
    dive.enemy.update(0, 400);
    expect(dive.enemy.aiState).toBe('recover');
    dive.enemy.applyHit({ amount: 99, form: 'projectile', element: 'fire' });
    expect(dive.enemy.isAlive).toBe(false);
    expect(dive.host.enemyDied).toHaveBeenCalledOnce();
    expect(dive.host.clearBossShots).toHaveBeenCalledWith(dive.enemy);
  });

  it('el Guardian organico hereda la carga y protege el frente dejando vulnerable el flanco', () => {
    const { enemy, host } = setup('organic-guardian', 65);
    expect(enemy.def).toMatchObject({ sprite: 'organic-guardian', guard: 0, attack: { kind: 'lunge', power: 184, recovery: 1.45 } });
    expect(enemy.applyHit({ amount: 1, form: 'projectile', element: 'fire', fromX: 40 })).toMatchObject({ damage: 0, immune: true });
    enemy.update(0, 16);
    expect(enemy.aiState).toBe('attack');
    enemy.update(0, 950);
    expect(enemy.body.velocity.x).toBe(-184);
    enemy.update(0, 400);
    expect(enemy.aiState).toBe('recover');
    expect(enemy.applyHit({ amount: 1, form: 'projectile', element: 'fire', fromX: 40 })).toMatchObject({ damage: 0, immune: true });
    expect(enemy.applyHit({ amount: 1, form: 'projectile', element: 'fire', fromX: 160 }).damage).toBeGreaterThan(0);
    enemy.applyHit({ amount: 99, form: 'projectile', element: 'fire', fromX: 160 });
    expect(enemy.isAlive).toBe(false);
    expect(host.enemyDied).toHaveBeenCalledOnce();
    expect(host.clearBossShots).toHaveBeenCalledWith(enemy);
  });

  it('mantiene activa la senal bio-hive mientras quede un tecnico y la sincroniza al pausar', () => {
    const first = { def: catalogs.enemies.enemies['bio-technician'], isAlive: true, x: 20, y: 30, displayHeight: 24 };
    const second = { def: catalogs.enemies.enemies['bio-technician'], isAlive: true, x: 40, y: 30, displayHeight: 24 };
    const enemySignal = vi.fn();
    const combat = Object.assign(Object.create(CombatSystem.prototype) as object, {
      enemies: { getChildren: () => [first, second] }, callbacks: { enemySignal, enemyKilled: vi.fn() },
      fx: { enemyDefeated: vi.fn() },
    }) as unknown as CombatSystem;
    combat.syncEnemySignals();
    expect(enemySignal).toHaveBeenLastCalledWith('bio-hive', true);
    combat.syncEnemySignals(false);
    expect(enemySignal).toHaveBeenLastCalledWith('bio-hive', false);
    combat.syncEnemySignals();
    first.isAlive = false;
    combat.enemyDied(first as Enemy);
    expect(enemySignal).toHaveBeenLastCalledWith('bio-hive', true);
    second.isAlive = false;
    combat.enemyDied(second as Enemy);
    expect(enemySignal).toHaveBeenLastCalledWith('bio-hive', false);
  });

  it('el Tecnico biologico avisa, ataca con esporas y limpia su vida al morir', () => {
    const { enemy, host } = setup('bio-technician');
    expect(enemy.def).toMatchObject({ activeSignal: 'bio-hive', sprite: 'bio-technician', element: 'plasma' });
    enemy.update(0, 16);
    expect(enemy.aiState).toBe('attack');
    expect(host.enemyShoot).not.toHaveBeenCalled();
    enemy.update(0, 1090);
    const [, velocityX, velocityY, damage] = vi.mocked(host.enemyShoot).mock.calls[0];
    expect(velocityX).toBe(-88);
    expect(velocityY).toBeCloseTo(0);
    expect(damage).toBe(1);
    enemy.update(0, 500);
    expect(enemy.aiState).toBe('recover');
    enemy.applyHit({ amount: 99, form: 'projectile', element: 'energy', fromX: 40 });
    expect(enemy.isAlive).toBe(false);
    expect(host.enemyDied).toHaveBeenCalledOnce();
    expect(host.clearBossShots).toHaveBeenCalledWith(enemy);
  });

  it('el cierre tolera grupos ya destruidos por Phaser sin eventos huérfanos', () => {
    const combat = Object.assign(Object.create(CombatSystem.prototype) as object, {
      enemies: { scene: undefined, getChildren: () => { throw new Error('Destroyed group'); } },
      enemyShots: { scene: undefined, getChildren: () => { throw new Error('Destroyed group'); } },
    }) as unknown as CombatSystem;
    const { enemy } = setup('omega-7');
    expect(() => combat.suspendBosses()).not.toThrow();
    expect(() => combat.clearBossShots(enemy)).not.toThrow();
  });
  it('el rayo de nivel 1 derrota OMEGA atravesando las tres fases con energía normal', () => {
    const { enemy, host } = setup('omega-7');
    const energy = new EnergyPool(100, 20, 0.6);
    const beam = catalogs.abilities.abilities.beam;
    const phases = new Set<number>();
    let cooldown = 0;
    for (let frame = 0; frame < 18000 && enemy.isAlive; frame++) {
      enemy.update(frame * 10, 10);
      phases.add(enemy.omega!.phase);
      energy.update(0.01);
      cooldown = Math.max(0, cooldown - 0.01);
      if (enemy.omega!.vulnerable && cooldown <= 0 && energy.tryConsume(beam.levels[0].energy)) {
        enemy.applyHit({ amount: beam.levels[0].params.damage, form: 'projectile', element: beam.element });
        cooldown = beam.levels[0].cooldown;
      }
    }
    expect([...phases]).toEqual([1, 2, 3]);
    expect(enemy.isAlive).toBe(false);
    expect(enemy.omega!.state).toBe('dead');
    expect(enemy.body.enable).toBe(false);
    expect(host.enemyDied).toHaveBeenCalledOnce();
    expect(host.bossHazards).toHaveBeenLastCalledWith(enemy, false);
    expect(host.clearBossShots).toHaveBeenCalled();
  });

  it('el daño que cambia de fase limpia ataques y no permite golpes durante la transición', () => {
    const { enemy, host } = setup('omega-7');
    enemy.update(0, 10);
    for (let frame = 0; frame < 320; frame++) enemy.update(frame * 10, 10);
    enemy.applyHit({ amount: 6, form: 'projectile', element: 'energy' });
    expect(enemy.omega!.state).toBe('transition');
    expect(enemy.applyHit({ amount: 99, form: 'projectile', element: 'energy' }).damage).toBe(0);
    expect(enemy.health.current).toBe(14);
    expect(enemy.contactActive).toBe(false);
    expect(host.clearBossShots).toHaveBeenCalled();
    expect(host.bossHazards).toHaveBeenLastCalledWith(enemy, false);
  });

  it('OMEGA solo recibe daño durante la recuperación y cambia de fase limpiando disparos', () => {
    const { enemy, host } = setup('omega-7');
    const hit = { amount: 1, form: 'projectile' as const, element: 'energy' };
    expect(enemy.applyHit(hit).damage).toBe(0);
    enemy.update(0, 16);
    for (let frame = 0; frame < 320; frame++) enemy.update(0, 10);
    expect(enemy.omega?.state).toBe('recover');
    expect(enemy.applyHit({ ...hit, amount: 6 }).damage).toBe(6);
    expect(enemy.health.current).toBe(14);
    expect(enemy.omega?.phase).toBe(2);
    expect(enemy.omega?.state).toBe('transition');
    expect(enemy.contactActive).toBe(false);
    expect(host.bossHazards).toHaveBeenLastCalledWith(enemy, false);
    expect(host.clearBossShots).toHaveBeenCalled();
  });

  it('OMEGA se reinicia con salud completa y sin ataques pendientes al reaparecer', () => {
    const { enemy, host } = setup('omega-7');
    enemy.update(0, 16);
    for (let frame = 0; frame < 320; frame++) enemy.update(0, 10);
    enemy.applyHit({ amount: 6, form: 'projectile', element: 'energy' });
    enemy.x = 150;
    enemy.suspendOmega(true);
    expect(enemy.health.current).toBe(20);
    expect(enemy.omega).toMatchObject({ phase: 1, state: 'dormant' });
    expect(enemy.x).toBe(100);
    expect(host.bossHazards).toHaveBeenLastCalledWith(enemy, false);
    enemy.destroy();
    expect(host.clearBossShots).toHaveBeenCalled();
  });

  it('la patrulla vertical invierte altura y mantiene la persecución acotada', () => {
    const zone = { range: 16, bob: 4, leash: 24, axis: 'y' as const };
    const home = { x: 100, y: 100 };
    expect(hoverPatrol(home, home, zone, 26, 1, 0)).toEqual({ vx: 0, vy: 26, dir: 1 });
    expect(hoverPatrol({ x: 100, y: 116 }, home, zone, 26, 1, 0).dir).toBe(-1);
    expect(hoverPatrol({ x: 100, y: 84 }, home, zone, 26, -1, 0).dir).toBe(1);
    expect(leashedChase({ x: 128, y: 140 }, { x: 200, y: 200 }, home, zone, 26)).toEqual({ vx: 0, vy: 0 });
  });

  it.each(['electric-drone', 'nexar-technician'])('%s prepara un solo disparo y queda vulnerable durante la recuperación', (id) => {
    const { enemy, host } = setup(id);
    enemy.update(0, 16);
    expect(enemy.aiState).toBe('attack');
    expect(enemy.body.velocity.x).toBe(0);
    expect(host.enemyShoot).not.toHaveBeenCalled();
    enemy.update(0, enemy.def.attack!.telegraph * 1000 - 100);
    expect(host.enemyShoot).not.toHaveBeenCalled();
    enemy.update(0, 100);
    expect(host.enemyShoot).toHaveBeenCalledTimes(1);
    enemy.update(0, 500);
    expect(enemy.aiState).toBe('recover');
    expect(enemy.body.velocity.x).toBe(0);
    expect(enemy.def.attack!.recovery).toBeGreaterThanOrEqual(1.2);
    enemy.update(0, 200);
    expect(enemy.aiState).toBe('recover');
    expect(host.enemyShoot).toHaveBeenCalledTimes(1);
  });

  it('el disparo eléctrico apunta desde la altura real de su emisor', () => {
    const { enemy, host } = setup('electric-drone');
    enemy.update(0, 16);
    enemy.update(0, 1000);
    const [, vx, vy] = vi.mocked(host.enemyShoot).mock.calls[0];
    expect(Math.hypot(vx, vy)).toBeCloseTo(80);
    expect(vx).toBeLessThan(0);
    expect(vy).toBeGreaterThan(0);
    expect(enemy.body.allowGravity).toBe(false);
  });

  it('el técnico limita su patrulla terrestre sin perseguir fuera del encuentro', () => {
    const { enemy } = setup('nexar-technician', -1000);
    enemy.x = 121;
    enemy.update(0, 16);
    expect(enemy.body.velocity.x).toBe(-14);
    enemy.x = 79;
    enemy.update(0, 16);
    expect(enemy.body.velocity.x).toBe(14);
    expect(enemy.body.allowGravity).toBe(true);
  });

  it('la torreta fija no detecta detrás y la variante derecha invierte el disparo', () => {
    const left = setup('auto-turret', 140);
    left.enemy.update(0, 1000);
    expect(left.enemy.aiState).toBe('idle');
    expect(left.host.enemyShoot).not.toHaveBeenCalled();
    expect(left.enemy.body.immovable).toBe(true);
    const right = setup('auto-turret-right', 160);
    right.enemy.update(0, 16);
    right.enemy.update(0, 900);
    expect(right.host.enemyShoot).toHaveBeenCalledWith(right.enemy, 132, 0, 1);
    expect(right.enemy.flipX).toBe(true);
  });

  it('avisa y dispara tres proyectiles separados por 0.25 segundos antes de descansar', () => {
    const { enemy, host } = setup();
    enemy.update(0, 0);
    expect(enemy.aiState).toBe('attack');
    expect(host.enemyShoot).not.toHaveBeenCalled();
    expect(enemy.body.velocity.x).toBe(0);
    enemy.update(0, 590);
    expect(host.enemyShoot).not.toHaveBeenCalled();
    enemy.update(0, 11);
    expect(host.enemyShoot).toHaveBeenCalledTimes(1);
    enemy.update(0, 240);
    expect(host.enemyShoot).toHaveBeenCalledTimes(1);
    enemy.update(0, 10);
    expect(host.enemyShoot).toHaveBeenCalledTimes(2);
    enemy.update(0, 250);
    expect(host.enemyShoot).toHaveBeenCalledTimes(3);
    enemy.update(0, 10);
    expect(enemy.aiState).toBe('recover');
    enemy.update(0, 1690);
    expect(host.enemyShoot).toHaveBeenCalledTimes(3);
    enemy.update(0, 11);
    expect(enemy.aiState).toBe('attack');
    expect(host.enemyShoot).toHaveBeenCalledTimes(3);
    enemy.update(0, 600);
    expect(host.enemyShoot).toHaveBeenCalledTimes(4);
    for (const [, vx, vy] of vi.mocked(host.enemyShoot).mock.calls) {
      expect(vx).toBe(-132);
      expect(vy).toBeCloseTo(0);
    }
  });

  it('no inicia un ataque sin objetivo vivo ni fuera del alcance', () => {
    const { enemy, host, target } = setup();
    target.alive = false;
    enemy.update(0, 16);
    expect(enemy.aiState).toBe('idle');
    target.alive = true;
    target.x = -1000;
    enemy.update(0, 16);
    expect(enemy.aiState).toBe('idle');
    expect(host.enemyShoot).not.toHaveBeenCalled();
  });

  it('el guardian anuncia, embiste por tierra y deja una recuperación inmóvil', () => {
    const { enemy } = setup('armored-guardian', 65);
    enemy.body.setVelocityY(12);
    enemy.update(0, 16);
    expect(enemy.aiState).toBe('attack');
    expect(enemy.body.velocity.x).toBe(0);
    enemy.update(0, 850);
    expect(enemy.body.velocity.x).toBe(-208);
    expect(enemy.body.velocity.y).toBe(12);
    enemy.update(0, 400);
    expect(enemy.aiState).toBe('recover');
    expect(enemy.body.velocity.x).toBe(0);
    expect(ENEMY_ANIMS.find((animation) => animation.key === 'platformer.enemy.guardian.recover')?.frames).toEqual([4]);
    enemy.update(0, 700);
    expect(enemy.aiState).toBe('recover');
    enemy.update(0, 900);
    expect(enemy.aiState).toBe('patrol');
  });

  it('el guardian no convierte su embestida en seguimiento al saltar por encima', () => {
    const { enemy, target } = setup('armored-guardian', 65);
    enemy.update(0, 16);
    target.x = 135;
    target.y = 30;
    enemy.update(0, 850);
    expect(enemy.body.velocity.x).toBe(-208);
    expect(enemy.body.velocity.y).toBe(0);
  });

  it('el escudo bloquea el frente y solo admite golpes por la espalda incluso en recuperacion', () => {
    const { enemy } = setup('armored-guardian', 65);
    const hit = { amount: 1, form: 'projectile' as const, element: 'energy', fromX: 40 };
    expect(enemy.applyHit(hit)).toEqual({ damage: 0, killed: false, immune: true });
    enemy.update(0, 16);
    enemy.update(0, 850);
    enemy.update(0, 400);
    expect(enemy.aiState).toBe('recover');
    expect(enemy.applyHit(hit).damage).toBe(0);
    expect(enemy.applyHit({ ...hit, fromX: 160 }).damage).toBe(1);
  });

  it.each(['energy', 'fire', 'ice', 'laser'])('el escudo bloquea %s frontal sin estados ni retroceso', (element) => {
    const { enemy } = setup('armored-guardian', 65);
    for (const form of ['projectile', 'area', 'stomp'] as const) {
      expect(enemy.applyHit({ amount: 10, form, element, fromX: 40, ignoreArmor: true, effects: [{ id: 'burn', chance: 1 }] })).toEqual({ damage: 0, killed: false, immune: true });
    }
    expect(enemy.health.current).toBe(4);
    expect(enemy.status.ids).toEqual([]);
    expect(enemy.body.velocity.x).toBe(0);
    expect(enemy.applyHit({ amount: 1, form: 'projectile', element, fromX: 160 }).damage).toBeGreaterThan(0);
  });

  it('orienta el escudo a la derecha y no gira durante la recuperacion', () => {
    const { enemy, target } = setup('armored-guardian', 135);
    enemy.update(0, 0);
    enemy.update(0, 850);
    expect(enemy.body.velocity.x).toBe(208);
    target.x = 40;
    enemy.update(0, 400);
    expect(enemy.aiState).toBe('recover');
    expect(enemy.applyHit({ amount: 1, form: 'projectile', fromX: 160 }).damage).toBe(0);
    enemy.update(0, 500);
    expect(enemy.applyHit({ amount: 1, form: 'area', fromX: 160 }).damage).toBe(0);
    expect(enemy.applyHit({ amount: 1, form: 'area', fromX: 40 }).damage).toBe(1);
  });

  it('el laser penetrante no ignora el escudo direccional', () => {
    const { enemy } = setup('armored-guardian');
    const combat = Object.assign(Object.create(CombatSystem.prototype) as object, {
      terrain: { getTileAtWorldXY: () => null }, enemies: { getChildren: () => [enemy] },
      fx: { impact: vi.fn() }, scene: { sound: { mute: true } },
    }) as unknown as CombatSystem;
    Object.assign(enemy.body, { x: 90, y: 76, width: 20, height: 24 });
    combat.fireBeam({ x: 40, y: 90, dir: 1, range: 200, height: 12, pierce: 8, hit: { amount: 3, form: 'projectile', element: 'laser', ignoreArmor: true } });
    expect(enemy.health.current).toBe(4);
    combat.fireBeam({ x: 160, y: 90, dir: -1, range: 200, height: 12, pierce: 8, hit: { amount: 1, form: 'projectile', element: 'laser' } });
    expect(enemy.health.current).toBeLessThan(4);
  });

  it('cancela rafagas al perder al jugador o morir sin acumular disparos tras pausas largas', () => {
    const { enemy, host, target } = setup();
    enemy.update(0, 0);
    enemy.update(0, 600);
    expect(host.enemyShoot).toHaveBeenCalledTimes(1);
    enemy.update(0, 9000);
    expect(host.enemyShoot).toHaveBeenCalledTimes(2);
    target.alive = false;
    enemy.update(0, 1000);
    expect(host.enemyShoot).toHaveBeenCalledTimes(2);
    enemy.applyHit({ amount: 99, form: 'projectile' });
    enemy.update(0, 10000);
    expect(host.enemyShoot).toHaveBeenCalledTimes(2);
    expect(host.clearBossShots).toHaveBeenCalledWith(enemy);
  });

  it('retira solo los disparos del enemigo muerto y vacia los restantes al morir el jugador', () => {
    const { enemy } = setup();
    const owned = { active: true, getData: () => enemy, destroy: vi.fn() };
    const other = { active: true, getData: () => null, destroy: vi.fn() };
    const shots = { scene: {}, getChildren: () => [owned, other], clear: vi.fn() };
    const combat = Object.assign(Object.create(CombatSystem.prototype) as object, {
      enemyShots: shots, playerShots: { getChildren: () => [] }, player: { isAlive: false },
    }) as unknown as CombatSystem;
    combat.clearBossShots(enemy);
    expect(owned.destroy).toHaveBeenCalledOnce();
    expect(other.destroy).not.toHaveBeenCalled();
    combat.update();
    expect(shots.clear).toHaveBeenCalledWith(true, true);
  });

  it('morir en mitad de una rafaga limpia sus proyectiles y no deja ataques al recrearse', () => {
    const first = setup();
    first.enemy.update(0, 0);
    first.enemy.update(0, 600);
    expect(first.host.enemyShoot).toHaveBeenCalledOnce();
    first.enemy.applyHit({ amount: 99, form: 'projectile' });
    first.enemy.update(0, 1000);
    expect(first.host.enemyShoot).toHaveBeenCalledOnce();
    expect(first.host.clearBossShots).toHaveBeenCalledWith(first.enemy);
    first.enemy.destroy();
    const second = setup();
    second.enemy.update(0, 0);
    second.enemy.update(0, 590);
    expect(second.host.enemyShoot).not.toHaveBeenCalled();
  });

  it('un proyectil no causa impactos duplicados y la invulnerabilidad consume el siguiente', () => {
    const player = { isInvulnerable: false };
    const damagePlayer = vi.fn(() => { player.isInvulnerable = true; });
    const combat = Object.assign(Object.create(CombatSystem.prototype) as object, {
      player, callbacks: { damagePlayer }, popShot: (shot: { destroy(): void }) => shot.destroy(),
    }) as unknown as { onShotHitsPlayer(player: unknown, shot: unknown): void };
    const shot = { active: true, x: 100, getData: (key: string) => key === 'damage' ? 1 : 'energy', destroy: () => { shot.active = false; } };
    combat.onShotHitsPlayer(player, shot);
    combat.onShotHitsPlayer(player, shot);
    expect(damagePlayer).toHaveBeenCalledOnce();
    const next = { ...shot, active: true, destroy: () => { next.active = false; } };
    combat.onShotHitsPlayer(player, next);
    expect(damagePlayer).toHaveBeenCalledOnce();
    expect(next.active).toBe(false);
  });

  it('dañar durante el aviso lo interrumpe sin dejar un disparo pendiente', () => {
    const { enemy, host } = setup();
    enemy.update(0, 16);
    enemy.applyHit({ amount: 0.1, form: 'projectile', element: 'energy' });
    enemy.update(0, 100);
    expect(enemy.aiState).toBe('hurt');
    enemy.update(0, 300);
    expect(enemy.aiState).toBe('recover');
    expect(host.enemyShoot).not.toHaveBeenCalled();
  });

  it('la patrulla del guardian queda acotada al encuentro', () => {
    const { enemy, target } = setup('armored-guardian', -1000);
    enemy.x = 125;
    enemy.update(0, 16);
    expect(enemy.body.velocity.x).toBe(-18);
    enemy.x = 75;
    enemy.update(0, 16);
    expect(enemy.body.velocity.x).toBe(18);
    target.alive = false;
    enemy.update(0, 16);
    expect(enemy.aiState).toBe('patrol');
  });

  it.each(['auto-turret', 'electric-drone', 'nexar-technician'])('%s: muerte única, cuerpo desactivado y limpieza de barra, flash y tween', (id) => {
    const { enemy, host, timers, tweens, bars } = setup(id);
    enemy.applyHit({ amount: 99, form: 'projectile', element: 'energy' });
    expect(enemy.isAlive).toBe(false);
    expect(enemy.aiState).toBe('death');
    expect(enemy.body.enable).toBe(false);
    enemy.update(0, 2000);
    enemy.applyHit({ amount: 99, form: 'projectile' });
    expect(host.enemyDied).toHaveBeenCalledTimes(1);
    expect(host.enemyShoot).not.toHaveBeenCalled();
    tweens[0].onComplete();
    expect(enemy.active).toBe(false);
    expect(timers[0].remove).toHaveBeenCalledWith(false);
    expect(tweens[0].stop).toHaveBeenCalledOnce();
    expect(bars[0].destroy).toHaveBeenCalledOnce();
  });

  it.each(['auto-turret', 'electric-drone', 'nexar-technician'])('%s: recrear tras reiniciar no conserva daño, aviso ni recursos del anterior', (id) => {
    const first = setup(id);
    first.enemy.update(0, 16);
    first.enemy.applyHit({ amount: 1, form: 'projectile' });
    first.enemy.destroy();
    expect(first.timers[0].remove).toHaveBeenCalledOnce();
    const second = setup(id);
    expect(second.enemy.health.current).toBe(2);
    expect(second.host.enemyShoot).not.toHaveBeenCalled();
    second.enemy.update(0, 16);
    expect(second.enemy.aiState).toBe('attack');
    expect(second.host.enemyShoot).not.toHaveBeenCalled();
  });
});