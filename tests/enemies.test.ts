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
  return { default: {
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

const assets = join(__dirname, '../public/assets/platformer');
const json = (file: string): unknown => JSON.parse(readFileSync(join(assets, file), 'utf8'));
const catalogs = buildCatalogs({ elements: json('combat/elements.json'), statuses: json('combat/status-effects.json'), enemies: json('enemies/enemies.json'), abilities: json('abilities/abilities.json') });

function setup(id = 'auto-turret', targetX = 40) {
  const target = { x: targetX, y: 90, alive: true };
  const timers: Array<{ remove: ReturnType<typeof vi.fn>; callback: () => void }> = [];
  const tweens: Array<{ stop: ReturnType<typeof vi.fn>; onComplete: () => void }> = [];
  const bars: Array<{ destroy: ReturnType<typeof vi.fn> }> = [];
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
    bossEngaged: vi.fn(() => target.alive), bossHazards: vi.fn(), clearBossShots: vi.fn(),
  };
  const enemy = new Enemy(scene as unknown as ConstructorParameters<typeof Enemy>[0], 100, 100, catalogs.enemies.enemies[id], host);
  return { enemy, host, target, timers, tweens, bars, scene };
}

describe('Enemy: torreta y guardian en el motor existente', () => {
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
    expect(right.host.enemyShoot).toHaveBeenCalledWith(right.enemy, 76, 0, 1);
    expect(right.enemy.flipX).toBe(true);
  });

  it('el aviso precede al proyectil y no se repite el disparo dentro del ataque', () => {
    const { enemy, host } = setup();
    enemy.update(0, 16);
    expect(enemy.aiState).toBe('attack');
    expect(host.enemyShoot).not.toHaveBeenCalled();
    expect(enemy.body.velocity.x).toBe(0);
    enemy.update(0, 400);
    expect(host.enemyShoot).not.toHaveBeenCalled();
    enemy.update(0, 500);
    expect(host.enemyShoot).toHaveBeenCalledTimes(1);
    const [, vx, vy] = vi.mocked(host.enemyShoot).mock.calls[0];
    expect(vx).toBe(-76);
    expect(Math.abs(vy)).toBeLessThan(0.001);
    enemy.update(0, 100);
    expect(host.enemyShoot).toHaveBeenCalledTimes(1);
    enemy.update(0, 400);
    expect(enemy.aiState).toBe('recover');
    enemy.update(0, 700);
    expect(host.enemyShoot).toHaveBeenCalledTimes(1);
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
    expect(enemy.body.velocity.x).toBe(-88);
    expect(enemy.body.velocity.y).toBe(12);
    enemy.update(0, 400);
    expect(enemy.aiState).toBe('recover');
    expect(enemy.body.velocity.x).toBe(0);
    expect(ENEMY_ANIMS.find((animation) => animation.key === 'platformer.enemy.guardian.recover')?.frames).toEqual([4]);
    enemy.update(0, 700);
    expect(enemy.aiState).toBe('recover');
    enemy.update(0, 600);
    expect(enemy.aiState).toBe('patrol');
  });

  it('el guardian no convierte su embestida en seguimiento al saltar por encima', () => {
    const { enemy, target } = setup('armored-guardian', 65);
    enemy.update(0, 16);
    target.x = 135;
    target.y = 30;
    enemy.update(0, 850);
    expect(enemy.body.velocity.x).toBe(-88);
    expect(enemy.body.velocity.y).toBe(0);
  });

  it('el escudo reduce el golpe frontal y queda abierto al contraataque', () => {
    const { enemy } = setup('armored-guardian');
    const hit = { amount: 1, form: 'projectile' as const, element: 'energy', fromX: 40 };
    expect(enemy.applyHit(hit).damage).toBe(0.5);
    expect(enemy.applyHit(hit).damage).toBe(1);
    const behind = setup('armored-guardian').enemy;
    expect(behind.applyHit({ ...hit, fromX: 160 }).damage).toBe(1);
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