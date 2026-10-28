import Phaser from 'phaser';
import { playSound } from '../../../core/audio/Sfx';
import { AUDIO } from '../assets/manifest';
import { hex, PALETTE } from '../assets/palette';
import { DEPTH } from '../view/ParallaxBackground';
import { type ObjectContext, type ObjectFactory, ObjectRegistry } from './LevelObjectManager';
import { type Box, boxesOverlap, doorShouldBeOpen, HazardCycle, type HazardPhase, hazardEnabled, PathMotion, SwitchModel } from './models';
import { boostPlantTexture, doorTexture, electricTexture, emitterTexture, organicNodeTexture, platformTexture, switchTexture, TILE, toxicTexture } from './objectArt';
import type { SceneHost } from './sceneHost';
import type { BoostPlantConfig, DoorConfig, ElectricFloorConfig, LaserConfig, MovingPlatformConfig, OrganicNodeConfig, SwitchConfig, ToxicFloorConfig } from './types';

type Host = ObjectContext<SceneHost>;

const playerBox = (host: Host): Box => {
  const b = host.player.body;
  return { x: b.x, y: b.y, width: b.width, height: b.height };
};

/** Damage goes through the level's single entry point, which already honours invulnerability frames. */
function hurtPlayer(host: Host, amount: number, element: string, fromX: number): void {
  const { player } = host;
  if (!player.isAlive || player.isInvulnerable) return;
  host.damagePlayer({ amount, form: 'area', element, fromX });
}

/** Solid-from-above slab that carries the player. Position follows a model, so it never drifts. */
const movingPlatform: ObjectFactory<SceneHost, MovingPlatformConfig> = (config, host) => {
  const { scene, player } = host;
  const startX = config.col * TILE;
  const startY = config.row * TILE;
  const sprite = scene.physics.add.image(startX, startY, platformTexture(scene, config.width)).setOrigin(0, 0).setDepth(DEPTH.props);
  const body = sprite.body as Phaser.Physics.Arcade.Body;
  body.setAllowGravity(false);
  body.setImmovable(true);
  // Only the top face collides: the player can jump up through it and is never crushed.
  body.checkCollision.down = false;
  body.checkCollision.left = false;
  body.checkCollision.right = false;
  const motion = new PathMotion({ travel: config.travel, speed: config.speed, wait: config.wait, offset: config.offset, tileSize: TILE });
  const target = (): { x: number; y: number } => ({
    x: startX + (config.axis === 'x' ? motion.displacement : 0),
    y: startY + (config.axis === 'y' ? motion.displacement : 0),
  });
  const first = target();
  body.reset(first.x, first.y);

  // Ignore the platform when the player is rising through it or well below its top.
  const collider = scene.physics.add.collider(player, sprite, undefined, () => player.body.velocity.y >= 0 && player.body.bottom <= body.top + 8);

  let destroyed = false;
  return {
    config,
    update(dt) {
      if (destroyed) return;
      motion.update(dt);
      // The body is steered to the model position within one physics step, so riders are carried by Arcade's own friction.
      const step = 1 / scene.physics.world.fps;
      const t = target();
      body.setVelocity((t.x - body.x) / step, (t.y - body.y) / step);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      collider.destroy();
      sprite.destroy();
    },
  };
};

/** Shared by lasers and electric floors: gate by switches, advance the cycle and report the phase. */
function runHazard(cycle: HazardCycle, config: LaserConfig | ElectricFloorConfig | ToxicFloorConfig, host: Host, dt: number): HazardPhase {
  cycle.setEnabled(hazardEnabled(config, host.signals));
  cycle.update(dt);
  return cycle.phase;
}

const laser: ObjectFactory<SceneHost, LaserConfig> = (config, host) => {
  const { scene } = host;
  const horizontal = config.orientation === 'horizontal';
  const emitter = scene.add.image(config.col * TILE + TILE / 2, config.row * TILE + TILE / 2, emitterTexture(scene)).setDepth(DEPTH.props + 1);
  const thickness = 4;
  const beam: Box = horizontal
    ? { x: (config.col + 1) * TILE, y: config.row * TILE + TILE / 2 - thickness / 2, width: config.length * TILE, height: thickness }
    : { x: config.col * TILE + TILE / 2 - thickness / 2, y: (config.row + 1) * TILE, width: thickness, height: config.length * TILE };
  const layer = (grow: number, color: number, alpha: number): Phaser.GameObjects.Rectangle =>
    scene.add
      .rectangle(beam.x - (horizontal ? 0 : grow), beam.y - (horizontal ? grow : 0), beam.width + (horizontal ? 0 : grow * 2), beam.height + (horizontal ? grow * 2 : 0), color, alpha)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.particles)
      .setVisible(false);
  const parts = [layer(2, hex(PALETTE.heart), 0.5), layer(1, hex(PALETTE.scarfLight), 0.9), layer(-1, 0xffffff, 1)];
  const cycle = new HazardCycle(config);
  let clock = 0;
  let sparkClock = 0;
  let destroyed = false;

  return {
    config,
    update(dt) {
      if (destroyed) return;
      clock += dt;
      const phase = runHazard(cycle, config, host, dt);
      const flicker = Math.floor(clock * 14) % 2 === 0;
      parts.forEach((p, i) => p.setVisible(phase === 'active' || (phase === 'warning' && i === 0 && flicker)).setAlpha(phase === 'warning' ? 0.3 : 1));
      emitter.setTint(phase === 'active' ? 0xffffff : phase === 'warning' && flicker ? 0xffb0b0 : 0xb0b0c8);
      if (phase !== 'active') return;
      sparkClock -= dt;
      if (sparkClock <= 0) {
        sparkClock = 0.12;
        const along = Math.random();
        host.fx.impact(beam.x + (horizontal ? beam.width * along : beam.width / 2), beam.y + (horizontal ? beam.height / 2 : beam.height * along), 'beam');
      }
      if (boxesOverlap(beam, playerBox(host))) hurtPlayer(host, config.damage, 'laser', beam.x + beam.width / 2);
    },
    pause() {
      cycle.setEnabled(false);
      parts.forEach((part) => part.setVisible(false));
      emitter.setTint(0xb0b0c8);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      emitter.destroy();
      parts.forEach((p) => p.destroy());
    },
  };
};

const electricFloor: ObjectFactory<SceneHost, ElectricFloorConfig> = (config, host) => {
  const { scene } = host;
  const cells = Array.from({ length: config.width }, (_, i) => scene.add.image(config.col * TILE + i * TILE, config.row * TILE, electricTexture(scene, 'off')).setOrigin(0, 0).setDepth(DEPTH.props));
  // Only the plate's bottom strip is dangerous, so jumping over it is safe.
  const zone: Box = { x: config.col * TILE, y: config.row * TILE + 9, width: config.width * TILE, height: 7 };
  const cycle = new HazardCycle(config);
  let clock = 0;
  let sparkClock = 0;
  let destroyed = false;

  return {
    config,
    update(dt) {
      if (destroyed) return;
      clock += dt;
      const phase = runHazard(cycle, config, host, dt);
      const frame = phase === 'active' ? (Math.floor(clock * 14) % 2 === 0 ? 'on' : 'on2') : phase === 'warning' && Math.floor(clock * 10) % 2 === 0 ? 'warning' : 'off';
      cells.forEach((cell) => cell.setTexture(electricTexture(scene, frame)));
      if (phase !== 'active') return;
      sparkClock -= dt;
      if (sparkClock <= 0) {
        sparkClock = 0.1;
        host.fx.impact(zone.x + Math.random() * zone.width, zone.y, 'beam');
      }
      if (boxesOverlap(zone, playerBox(host))) hurtPlayer(host, config.damage, 'energy', zone.x + zone.width / 2);
    },
    pause() {
      cycle.setEnabled(false);
      cells.forEach((cell) => cell.setTexture(electricTexture(scene, 'off')));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cells.forEach((cell) => cell.destroy());
    },
  };
};

const toxicFloor: ObjectFactory<SceneHost, ToxicFloorConfig> = (config, host) => {
  const { scene } = host;
  const cells = Array.from({ length: config.width }, (_, i) => scene.add.image(config.col * TILE + i * TILE, config.row * TILE, toxicTexture(scene, 'off')).setOrigin(0, 0).setDepth(DEPTH.props));
  const zone: Box = { x: config.col * TILE, y: config.row * TILE + 9, width: config.width * TILE, height: 7 };
  const cycle = new HazardCycle(config);
  let clock = 0;
  let damageLeft = 0;
  let destroyed = false;

  return {
    config,
    update(dt) {
      if (destroyed) return;
      clock += dt;
      const phase = runHazard(cycle, config, host, dt);
      const frame = phase === 'active' ? (Math.floor(clock * 8) % 2 === 0 ? 'on' : 'on2') : phase === 'warning' && Math.floor(clock * 8) % 2 === 0 ? 'warning' : 'off';
      cells.forEach((cell) => cell.setTexture(toxicTexture(scene, frame)));
      const touching = boxesOverlap(zone, playerBox(host));
      if (phase !== 'active' || !touching) {
        damageLeft = 0;
        return;
      }
      damageLeft = Math.max(0, damageLeft - dt);
      if (damageLeft > 0) return;
      damageLeft = config.interval;
      host.fx.impact(zone.x + zone.width / 2, zone.y, 'fire');
      hurtPlayer(host, config.damage, 'plasma', zone.x + zone.width / 2);
    },
    pause() {
      cycle.setEnabled(false);
      damageLeft = 0;
      cells.forEach((cell) => cell.setTexture(toxicTexture(scene, 'off')));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cells.forEach((cell) => cell.destroy());
    },
  };
};

const switchObject: ObjectFactory<SceneHost, SwitchConfig> = (config, host) => {
  const { scene } = host;
  const model = new SwitchModel(config.id, config.duration, host.signals);
  const sprite = scene.add.image(config.col * TILE, config.row * TILE, switchTexture(scene, false)).setOrigin(0, 0).setDepth(DEPTH.props);
  const zone: Box = { x: config.col * TILE + 2, y: config.row * TILE + 6, width: TILE - 4, height: TILE - 6 };
  let clock = 0;
  let destroyed = false;

  return {
    config,
    update(dt) {
      if (destroyed) return;
      clock += dt;
      model.update(dt);
      if (host.player.isAlive && boxesOverlap(zone, playerBox(host)) && model.activate()) {
        host.fx.checkpoint(sprite.x + TILE / 2, sprite.y + 4);
        playSound(scene, AUDIO.checkpoint);
      }
      // A timed switch blinks during its last second and a half.
      const blink = model.timeLeft > 0 && model.timeLeft < 1.5 && Math.floor(clock * 8) % 2 === 0;
      sprite.setTexture(switchTexture(scene, model.isOn && !blink));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      model.reset();
      sprite.destroy();
    },
  };
};

const door: ObjectFactory<SceneHost, DoorConfig> = (config, host) => {
  const { scene, player } = host;
  const x = config.col * TILE;
  const y = config.row * TILE;
  const sprite = scene.physics.add.image(x, y, doorTexture(scene, config.height, config.style)).setOrigin(0, 0).setDepth(DEPTH.props);
  const body = sprite.body as Phaser.Physics.Arcade.Body;
  body.setAllowGravity(false);
  body.setImmovable(true);
  body.setSize(10, config.height * TILE).setOffset(3, 0);
  const box: Box = { x: x + 1, y, width: TILE - 2, height: config.height * TILE };
  const collider = scene.physics.add.collider(player, sprite);
  let open = doorShouldBeOpen(config.opensWith, config.inverted, host.signals);
  let destroyed = false;

  const apply = (): void => {
    body.enable = !open;
    sprite.setVisible(!open);
  };
  apply();

  return {
    config,
    update() {
      if (destroyed) return;
      const wanted = doorShouldBeOpen(config.opensWith, config.inverted, host.signals);
      if (wanted === open) return;
      // Never close on top of the player: wait until the doorway is clear.
      if (!wanted && boxesOverlap(box, playerBox(host))) return;
      open = wanted;
      apply();
      host.fx.step(x + TILE / 2, y + config.height * TILE);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      collider.destroy();
      sprite.destroy();
    },
  };
};

const boostPlant: ObjectFactory<SceneHost, BoostPlantConfig> = (config, host) => {
  const { scene, player } = host;
  const x = config.col * TILE;
  const y = config.row * TILE;
  const sprite = scene.add.image(x, y, boostPlantTexture(scene, false)).setOrigin(0, 0).setDepth(DEPTH.props);
  const zone: Box = { x: x + 1, y: y + 4, width: TILE - 2, height: TILE - 4 };
  let armed = true;
  let openFor = 0;
  let destroyed = false;

  return {
    config,
    update(dt) {
      if (destroyed) return;
      const touching = player.isAlive && boxesOverlap(zone, playerBox(host));
      if (!touching) armed = true;
      if (touching && armed) {
        armed = false;
        openFor = 0.22;
        const diagonal = config.direction !== 'up';
        const horizontal = config.direction === 'up-left' ? -1 : 1;
        if (diagonal) player.body.setVelocityX(horizontal * config.force * 0.55);
        player.body.setVelocityY(-config.force);
        sprite.setTexture(boostPlantTexture(scene, true));
        host.fx.jump(x + TILE / 2, y + 4);
        playSound(scene, AUDIO.jump);
      }
      openFor = Math.max(0, openFor - dt);
      if (openFor === 0) sprite.setTexture(boostPlantTexture(scene, false));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      sprite.destroy();
    },
  };
};

const organicNode: ObjectFactory<SceneHost, OrganicNodeConfig> = (config, host) => {
  const { scene } = host;
  const model = new SwitchModel(config.id, config.mode === 'timed' ? config.duration : 0, host.signals);
  const sprite = scene.add.image(config.col * TILE, config.row * TILE, organicNodeTexture(scene, false)).setOrigin(0, 0).setDepth(DEPTH.props);
  const zone: Box = { x: config.col * TILE + 2, y: config.row * TILE + 2, width: TILE - 4, height: TILE - 2 };
  let wasTouching = false;
  let clock = 0;
  let destroyed = false;

  return {
    config,
    update(dt) {
      if (destroyed) return;
      clock += dt;
      model.update(dt);
      const touching = host.player.isAlive && boxesOverlap(zone, playerBox(host));
      if (touching && !wasTouching) {
        if (config.mode === 'toggle') model.toggle();
        else model.activate();
        host.fx.checkpoint(sprite.x + TILE / 2, sprite.y + 4);
        playSound(scene, AUDIO.checkpoint);
      }
      wasTouching = touching;
      const texture = organicNodeTexture(scene, model.isOn);
      sprite.setTexture(texture);
      if (config.mode === 'timed' && model.timeLeft > 0 && model.timeLeft < 1.5 && Math.floor(clock * 8) % 2 === 0) {
        sprite.setAlpha(0.55);
      } else sprite.setAlpha(1);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      model.reset();
      sprite.destroy();
    },
    reset() {
      if (destroyed) return;
      model.reset();
      wasTouching = host.player.isAlive && boxesOverlap(zone, playerBox(host));
      sprite.setTexture(organicNodeTexture(scene, false)).setAlpha(1);
    },
  };
};

/** Constructors of every built-in object type. Add new types here (and to OBJECT_TYPES / validate.ts). */
export function createDefaultRegistry(): ObjectRegistry<SceneHost> {
  return new ObjectRegistry<SceneHost>().register('movingPlatform', movingPlatform).register('laser', laser).register('electricFloor', electricFloor).register('switch', switchObject).register('door', door).register('boostPlant', boostPlant).register('toxicFloor', toxicFloor).register('organicNode', organicNode);
}
