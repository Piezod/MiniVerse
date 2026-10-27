import { describe, expect, it } from 'vitest';
import { OmegaController, omegaPhase } from '../src/games/platformer/enemies/OmegaController';
import { validateObjects } from '../src/games/platformer/objects/validate';
import { validateStory } from '../src/games/platformer/story/validate';

const advance = (controller: OmegaController, seconds: number, fraction = 1): string[] => {
  const attacks: string[] = [];
  for (let frame = 0; frame < Math.ceil(seconds * 100); frame++) {
    const attack = controller.update(0.01, fraction, true);
    if (attack) attacks.push(attack);
  }
  return attacks;
};

describe('OMEGA: máquina de estados de tres fases', () => {
  it('valida señales externas explícitas sin aceptar referencias inexistentes', () => {
    const objects = [{ type: 'laser', col: 5, row: 3, orientation: 'vertical', length: 5, enabledBy: 'omega-hazards' }];
    expect(validateObjects(objects, { width: 30, height: 20 }).ok).toBe(false);
    expect(validateObjects(objects, { width: 30, height: 20, externalSignals: ['omega-hazards'] }).ok).toBe(true);
    const conflict = [...objects, { type: 'switch', id: 'omega-hazards', col: 2, row: 10 }];
    expect(validateObjects(conflict, { width: 30, height: 20, externalSignals: ['omega-hazards'] }).ok).toBe(false);
  });

  it('reutiliza diálogos de evento sin dispararlos por una zona', () => {
    const result = validateStory({ beats: [{ id: 'boss-defeated', trigger: { type: 'event' }, blocking: true, lines: [{ speaker: 'luma', text: 'Coordenadas recuperadas' }] }] }, { width: 40, height: 24 });
    expect(result.ok).toBe(true);
    expect(result.beats[0].trigger).toEqual({ type: 'event' });
  });
  it('respeta exactamente los umbrales 70 y 35 por ciento', () => {
    expect([1, 0.71, 0.7, 0.36, 0.35, 0.01].map(omegaPhase)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('no ataca sin jugador y avisa antes de cada disparo', () => {
    const controller = new OmegaController();
    expect(controller.update(10, 1, false)).toBeNull();
    expect(controller.state).toBe('dormant');
    controller.update(0, 1, true);
    expect(controller.state).toBe('transition');
    expect(advance(controller, 1.8)).toEqual([]);
    expect(controller.state).toBe('telegraph');
    expect(advance(controller, 1.14)).toEqual([]);
    expect(advance(controller, 0.01)).toEqual(['shot']);
    expect(advance(controller, 0.2)).toEqual([]);
    expect(controller.vulnerable).toBe(true);
  });

  it('alterna disparo y ataque frontal en fase 1', () => {
    const controller = new OmegaController();
    controller.update(0, 1, true);
    expect(advance(controller, 12).slice(0, 3)).toEqual(['shot', 'dash', 'shot']);
  });

  it('las transiciones retiran contacto y peligros y no emiten ataques', () => {
    const controller = new OmegaController();
    controller.update(0, 1, true);
    advance(controller, 3);
    expect(controller.update(0.01, 0.7, true)).toBeNull();
    expect(controller.phase).toBe(2);
    expect(controller.state).toBe('transition');
    expect(controller.hazardsActive).toBe(false);
    expect(controller.contactActive).toBe(false);
    expect(controller.vulnerable).toBe(false);
    expect(advance(controller, 1.8, 0.7)).toEqual([]);
    expect(controller.state).toBe('telegraph');
  });

  it('activa peligros en fase 2 y añade combinaciones más rápidas en fase 3', () => {
    const second = new OmegaController();
    second.update(0, 0.7, true);
    const attacks = advance(second, 12, 0.7);
    expect(attacks).toEqual(expect.arrayContaining(['shot', 'lasers', 'dash']));
    const third = new OmegaController();
    third.update(0, 0.35, true);
    expect(third.telegraphDuration).toBeLessThan(second.telegraphDuration);
    expect(advance(third, 2.65, 0.35)).toEqual(['combo']);
    expect(third.hazardsActive).toBe(true);
    expect(third.contactActive).toBe(true);
    advance(third, 1.2, 0.35);
    expect(third.state).toBe('recover');
    expect(third.hazardsActive).toBe(false);
  });

  it('no duplica proyectiles tras fotogramas largos ni actúa después de morir', () => {
    const controller = new OmegaController();
    controller.update(0, 1, true);
    expect(controller.update(999, 1, true)).toBeNull();
    expect(controller.state).toBe('transition');
    advance(controller, 5);
    controller.defeat();
    expect(advance(controller, 60, 0)).toEqual([]);
    expect(controller.state).toBe('dead');
    expect(controller.hazardsActive).toBe(false);
  });

  it('suspender al morir el jugador retira todos los ataques pendientes', () => {
    const controller = new OmegaController();
    controller.update(0, 0.35, true);
    advance(controller, 2.65, 0.35);
    controller.update(0, 0.35, false);
    expect(controller.state).toBe('dormant');
    expect(controller.hazardsActive).toBe(false);
    expect(controller.contactActive).toBe(false);
    controller.update(0, 0.35, true);
    expect(controller.state).toBe('transition');
  });
});