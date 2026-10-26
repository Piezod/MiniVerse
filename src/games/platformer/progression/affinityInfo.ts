/** Data and navigation of the affinity screen (Phaser-free apart from scene keys). */
import type { ElementChart } from '../combat/elements';
import { PlatformerScenes } from '../config';

export interface Matchup {
  id: string;
  name: string;
  multiplier: number;
}

export interface AffinityNode {
  id: string;
  name: string;
  color: string;
  strong: Matchup[];
  weak: Matchup[];
}

export interface AffinityArrow {
  from: string;
  to: string;
  multiplier: number;
}

export const AFFINITY_KEYS = { open: 'A', back: ['ESC', 'A', 'ENTER'] } as const;

/** One entry per element, in the order of elements.json, with its strong and weak matchups. */
export function affinityNodes(chart: ElementChart): AffinityNode[] {
  const matchup = (attacker: string) => (id: string): Matchup => ({ id, name: chart.elements[id].name, multiplier: chart.multiplier(attacker, id) });
  return Object.values(chart.elements).map((el) => ({
    id: el.id,
    name: el.name,
    color: el.color,
    strong: chart.strongAgainst(el.id).map(matchup(el.id)),
    weak: chart.weakAgainst(el.id).map(matchup(el.id)),
  }));
}

/** Arrows of the circle: attacker → defender with offensive advantage. */
export function affinityArrows(chart: ElementChart): AffinityArrow[] {
  return affinityNodes(chart).flatMap((n) => n.strong.map((m) => ({ from: n.id, to: m.id, multiplier: m.multiplier })));
}

export interface SceneTarget {
  key: string;
  data: { selected: number };
}

/** Shop → affinity screen, remembering the selected shop row. */
export const toAffinity = (selected: number): SceneTarget => ({ key: PlatformerScenes.Affinity, data: { selected } });

/** Affinity screen → shop, restoring the selected row. */
export const fromAffinity = (selected: number): SceneTarget => ({ key: PlatformerScenes.Shop, data: { selected } });
