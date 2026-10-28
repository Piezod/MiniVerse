import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Geom: { Rectangle: class {} }, Input: { Keyboard: { KeyCodes: {} } } } }));

import { BIOME_THEMES, BIOME_VARIANTS, BIOMES, getBiome } from '../src/games/platformer/biomes';
import { ownedParts } from '../src/games/platformer/biomes/createBiome';
import { STATION_DEFINITION } from '../src/games/platformer/biomes/definitions/station';
import { DECO, DECO_FRAME_COUNT } from '../src/games/platformer/biomes/biomeArt';
import { buildCampaign, CampaignManager, type CampaignContext } from '../src/games/platformer/level/CampaignManager';
import { chapterCards } from '../src/games/platformer/level/campaignView';
import { type LevelEntry, LevelManager, memoryStorage } from '../src/games/platformer/level/LevelManager';
import { analyzeReachability, validateLevel } from '../src/games/platformer/level/LevelValidator';
import { queueLevels } from '../src/games/platformer/level/levelLoader';
import { buildCatalogs } from '../src/games/platformer/progression/gameData';
import { hoverPatrol, leashedChase, lungeVelocity, telegraphOn } from '../src/games/platformer/enemies/flight';
import { nextAiState } from '../src/games/platformer/enemies/ai';
import { computeDamage, Health } from '../src/games/platformer/combat/damage';
import { validateObjects } from '../src/games/platformer/objects/validate';
import type { ElectricFloorConfig, LaserConfig } from '../src/games/platformer/objects/types';
import { doorShouldBeOpen, hazardEnabled, SignalBus, SwitchModel } from '../src/games/platformer/objects/models';
import { withObjectSupport } from '../src/games/platformer/objects/reachSupport';
import { validateBossEncounter } from '../src/games/platformer/level/BossEncounter';
import { StoryDirector, TYPE_SPEED } from '../src/games/platformer/story/StoryDirector';
import { validateStory } from '../src/games/platformer/story/validate';

const ASSETS = join(__dirname, '../public/assets/platformer');
const readJson = (path: string): any => JSON.parse(readFileSync(join(ASSETS, path), 'utf8'));
const catalogs = buildCatalogs({
  elements: readJson('combat/elements.json'),
  statuses: readJson('combat/status-effects.json'),
  enemies: readJson('enemies/enemies.json'),
  abilities: readJson('abilities/abilities.json'),
});
const BIOME_IDS = Object.keys(BIOMES);
const EPISODES = ['c1-1-hangar', 'c1-2-corridors', 'c1-3-reactor', 'c1-4-omega'];
const ALIEN_EPISODES = ['c2-1-landing', 'c2-2-caves', 'c2-3-lab', 'c2-4-queen'];

let validatedEntries: LevelEntry[] | undefined;
function realEntries(): LevelEntry[] {
  validatedEntries ??= (readJson('levels/levels.json').levels as string[]).map((file, index) => {
    const validation = validateLevel(readJson(`levels/${file}`), BIOME_IDS, catalogs.enemies.enemies, BIOME_VARIANTS);
    const data = validation.level!;
    return { index, file, id: data.id, name: data.name, biome: data.biome, data, validation };
  });
  return validatedEntries.map((entry) => ({ ...entry, data: structuredClone(entry.data) }));
}
const realContext = (entries = realEntries()): CampaignContext => ({
  levels: entries,
  biomes: BIOME_IDS,
  variants: BIOME_VARIANTS,
  enemies: catalogs.enemies.enemies,
  abilities: catalogs.abilities.abilities,
});
const realCampaign = (storage = memoryStorage()) => {
  const entries = realEntries();
  const levels = new LevelManager(entries, storage);
  const built = buildCampaign(readJson('campaign.json'), realContext(entries));
  return { ...built, entries, levels, campaign: new CampaignManager(built.chapters, levels, built.meta) };
};

/** Synthetic levels that would exist when chapter 1 gets its content. */
const futureEntries = (): LevelEntry[] =>
  EPISODES.map((id, index) => {
    const variant = ['hangar', 'corridors', 'reactor', 'boss'][index];
    return { index, file: `${id}.json`, id, name: id, biome: 'station', data: { variant }, validation: { ok: true, issues: [], parsed: { stars: [{}, {}, {}] } } } as unknown as LevelEntry;
  });
const chapterJson = (extra: Record<string, unknown> = {}) => ({ id: 'c', name: 'C', order: 0, biome: 'station', planned: true, plannedLevels: 2, levels: [], unlock: null, ...extra });
const build = (chapters: unknown[], ctx: Partial<CampaignContext> = {}) => buildCampaign({ chapters }, { ...realContext([]), ...ctx });

describe('campaign.json: capítulo 1 (La estación fantasma)', () => {
  const { chapters, issues, meta } = realCampaign();
  const station = chapters.find((c) => c.id === 'station')!;

  it('la configuración completa es válida contra biomas, variantes, enemigos y habilidades reales', () => {
    expect(issues).toEqual([]);
    expect(chapters.map((c) => [c.id, c.status])).toEqual([
      ['prologue', 'ready'],
      ['station', 'ready'],
      ['alien', 'ready'],
    ]);
  });

  it('define el capítulo con nombre, descripción, bioma, requisito y cuatro episodios', () => {
    expect(station).toMatchObject({ name: 'La estación fantasma', order: 1, biome: 'station', unlock: [], plannedLevels: 0, levels: EPISODES, rewards: [] });
    expect(station.description).toMatch(/LUMA/);
    expect(station.episodes.map((e) => e.id)).toEqual(EPISODES);
    expect(station.episodes.map((e) => e.title)).toEqual(['Despertar en el Hangar', 'Pasillos de seguridad', 'El reactor inestable', 'Protocolo OMEGA']);
    expect(station.episodes.map((e) => e.variant)).toEqual(['hangar', 'corridors', 'reactor', 'boss']);
    expect(station.episodes.map((e) => e.boss)).toEqual([null, null, null, 'omega-7']);
    expect(station.episodes.every((e) => e.summary.length > 0)).toBe(true);
  });

  it('describe la campaña y su reparto', () => {
    expect(meta).toMatchObject({ id: 'the-last-signal', title: 'MiniVerse — La última señal', protagonist: 'piezod' });
    expect(Object.keys(meta!.characters)).toEqual(['piezod', 'luma', 'nexar', 'omega-7']);
    expect(meta!.characters.piezod.name).toBe('PIEZOD');
    expect(meta!.characters.nexar.name).toBe('NÉXAR');
    expect(meta!.synopsis).toMatch(/LUMA/);
  });

  it('conserva el prólogo y mantiene el capítulo alien bloqueado por estación', () => {
    const { campaign } = realCampaign();
    const cards = chapterCards(campaign, (id) => BIOMES[id]?.name ?? id);
    expect(cards.map((c) => [c.id, c.stateLabel, c.selectable])).toEqual([
      ['prologue', 'Disponible', true],
      ['station', 'Disponible', true],
      ['alien', 'Bloqueado', false],
    ]);
    expect(chapters[0].levels).toEqual(['forest-1', 'ruins-1', 'ice-1', 'volcano-1']);
  });
});

describe('el capítulo 1 publica Hangar, Pasillos y Reactor', () => {
  it('guarda el Hangar sin completar el capítulo ni desbloquear episodios inexistentes', () => {
    const storage = memoryStorage();
    const { campaign } = realCampaign(storage);
    expect(campaign.isLevelUnlocked('c1-1-hangar')).toBe(true);
    expect(campaign.isChapterCompleted('prologue')).toBe(false);
    const result = campaign.complete('c1-1-hangar', { stars: 5, total: 27 });
    expect(result).toMatchObject({ next: { id: 'c1-2-corridors' }, chapterCompleted: false, unlockedChapters: [] });
    const restored = realCampaign(storage).campaign;
    expect(restored.progressOfLevel('c1-1-hangar')).toEqual({ stars: 5, total: 27 });
    expect(restored.progressOf('station')).toMatchObject({ completed: 1, total: 4, stars: 5, isCompleted: false });
    expect(restored.episodesOf('station').map((episode) => [episode.playable, episode.completed])).toEqual([[true, true], [true, false], [false, false], [false, false]]);
    expect(restored.isChapterUnlocked('alien')).toBe(false);
    expect(restored.progressOf('prologue').completed).toBe(0);
    expect(restored.earnedRewards()).toEqual([]);
  });

  it.each([
    { mode: 'development', development: true },
    { mode: 'staging', development: false },
    { mode: 'production', development: false },
  ])('carga el Hangar por el flujo normal en $mode', ({ mode, development }) => {
    vi.stubEnv('DEV', development);
    vi.stubEnv('MODE', mode);
    try {
      const json = vi.fn();
      const once = vi.fn();
      queueLevels({ load: { json, once } } as unknown as Parameters<typeof queueLevels>[0]);
      once.mock.calls[0][1]('', '', readJson('levels/levels.json'));
      expect(json.mock.calls.map((call) => call[1])).toEqual([
        'assets/platformer/campaign.json',
        'assets/platformer/levels/levels.json',
        'assets/platformer/levels/01-forest.json',
        'assets/platformer/levels/02-ruins.json',
        'assets/platformer/levels/03-ice.json',
        'assets/platformer/levels/04-volcano.json',
        'assets/platformer/levels/chapter1/01-hangar.json',
        'assets/platformer/levels/chapter1/02-corridors.json',
        'assets/platformer/levels/chapter1/03-reactor.json',
        'assets/platformer/levels/chapter1/04-omega.json',
        'assets/platformer/levels/chapter2/01-landing.json',
        'assets/platformer/levels/chapter2/02-caves.json',
        'assets/platformer/levels/chapter2/03-lab.json',
        'assets/platformer/levels/chapter2/04-queen.json',
      ]);
      const entries = realEntries();
      const built = buildCampaign(readJson('campaign.json'), realContext(entries));
      expect(built.issues).toEqual([]);
      const campaign = new CampaignManager(built.chapters, new LevelManager(entries, memoryStorage()), built.meta);
      expect(campaign.chapter('station')).toMatchObject({ status: 'ready', levels: EPISODES });
      expect(campaign.availableChapters().map((chapter) => chapter.id)).toEqual(['prologue', 'station']);
      expect(campaign.episodesOf('station').map((episode) => [episode.playable, episode.completed])).toEqual([[true, false], [false, false], [false, false], [false, false]]);
      expect(campaign.progressOf('prologue').completed).toBe(0);
      expect(campaign.progressOf('station').completed).toBe(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('completar el prólogo no cambia la disponibilidad inicial del Hangar ni abre episodios pendientes', () => {
    const { campaign } = realCampaign();
    for (const id of ['forest-1', 'ruins-1', 'ice-1', 'volcano-1']) campaign.complete(id, { stars: 1, total: 10 });
    expect(campaign.isChapterCompleted('prologue')).toBe(true);
    expect(campaign.isChapterUnlocked('station')).toBe(true);
    expect(campaign.availableChapters().map((c) => c.id)).toEqual(['prologue', 'station']);
    expect(campaign.levelsOf('station').map((entry) => entry.id)).toEqual(EPISODES);
    expect(campaign.nextChapter('prologue')?.id).toBe('station');
  });

  it('Hangar está disponible y Pasillos espera a completarlo, sin exigir el prólogo', () => {
    const { campaign } = realCampaign();
    const info = campaign.episodesOf('station');
    expect(info).toHaveLength(4);
    expect(info.map((i) => [i.level?.id, i.playable, i.completed])).toEqual([
      ['c1-1-hangar', true, false],
      ['c1-2-corridors', false, false],
      ['c1-3-reactor', false, false],
      ['c1-4-omega', false, false],
    ]);
    expect(campaign.episodesOf('prologue')).toEqual([]);
    expect(campaign.episodesOf('nope')).toEqual([]);
  });

  it('el registro carga los cuatro episodios y todos sus archivos existen', () => {
    const registry = readJson('levels/levels.json').levels as string[];
    expect(registry).toHaveLength(12);
    expect(registry[4]).toBe('chapter1/01-hangar.json');
    expect(registry[5]).toBe('chapter1/02-corridors.json');
    expect(registry[6]).toBe('chapter1/03-reactor.json');
    expect(registry[7]).toBe('chapter1/04-omega.json');
    expect(realEntries().filter((entry) => EPISODES.includes(entry.id)).map((entry) => entry.id)).toEqual(EPISODES);
    expect(readJson('campaign.json').chapters[1].levels).toEqual(EPISODES);
  });

  it('los cuatro niveles originales mantienen id, nombre, bioma y estrellas', () => {
    const originalIds = ['forest-1', 'ruins-1', 'ice-1', 'volcano-1'];
    const entries = realEntries().filter((entry) => originalIds.includes(entry.id));
    expect(entries.map((e) => [e.id, e.biome, e.validation.parsed?.stars.length, e.validation.ok])).toEqual([
      ['forest-1', 'forest', 37, true],
      ['ruins-1', 'ruins', 19, true],
      ['ice-1', 'ice', 23, true],
      ['volcano-1', 'volcano', 31, true],
    ]);
    expect(entries.map((e) => e.file)).toEqual(['01-forest.json', '02-ruins.json', '03-ice.json', '04-volcano.json']);
  });
});

describe('partidas guardadas anteriores', () => {
  it('un guardado v1 conserva el prólogo completado y desbloquea el Hangar', () => {
    const storage = memoryStorage();
    storage.save(JSON.stringify({ unlocked: ['forest-1', 'ruins-1', 'ice-1', 'volcano-1'], best: { 'forest-1': { stars: 30, total: 37 }, 'ruins-1': { stars: 12, total: 19 }, 'ice-1': { stars: 9, total: 23 }, 'volcano-1': { stars: 4, total: 31 } } }));
    const { campaign, levels } = realCampaign(storage);
    expect(levels.best('forest-1')).toEqual({ stars: 30, total: 37 });
    expect(campaign.isChapterCompleted('prologue')).toBe(true);
    expect(campaign.progressOf('prologue')).toMatchObject({ completed: 4, stars: 55 });
    expect(campaign.progressOf('station')).toMatchObject({ completed: 0, total: 4, stars: 0, status: 'ready', unlocked: true });
    expect(JSON.parse(storage.load()!).version).toBe(2);
  });

  it('un guardado v2 se carga igual y no se reescribe', () => {
    const storage = memoryStorage();
    const v2 = JSON.stringify({ version: 2, best: { 'forest-1': { stars: 1, total: 1 } } });
    storage.save(v2);
    realCampaign(storage);
    expect(storage.load()).toBe(v2);
  });

  it('resultados de niveles que aún no existen se ignoran sin romper el progreso', () => {
    const storage = memoryStorage();
    storage.save(JSON.stringify({ version: 2, best: { 'forest-1': { stars: 5, total: 37 }, 'future-alien': { stars: 3, total: 3 } } }));
    const { campaign } = realCampaign(storage);
    expect(campaign.progressOf('prologue').completed).toBe(1);
    expect(campaign.progressOf('station').completed).toBe(0);
    expect(campaign.isChapterUnlocked('station')).toBe(true);
  });
});

describe('cómo se activará el capítulo 1', () => {
  const ready = (episodes?: unknown) => ({
    id: 'station',
    name: 'La estación fantasma',
    order: 1,
    biome: 'station',
    levels: EPISODES,
    unlock: { chapters: ['prologue'] },
    ...(episodes === undefined ? { episodes: readJson('campaign.json').chapters[1].episodes } : { episodes }),
  });
  const prologue = { id: 'prologue', name: 'P', order: 0, biome: null, levels: ['forest-1', 'ruins-1', 'ice-1', 'volcano-1'], unlock: null };
  const withFuture = (stationChapter: unknown, enemies: CampaignContext['enemies'] = { ...catalogs.enemies.enemies, 'omega-7': { boss: true } as never }) => {
    const entries = [...realEntries().filter((entry) => !EPISODES.includes(entry.id) && !ALIEN_EPISODES.includes(entry.id)), ...futureEntries()];
    return buildCampaign({ chapters: [prologue, stationChapter] }, { ...realContext(entries), enemies });
  };

  it('listando los niveles y quitando "planned" el capítulo pasa a jugable y los episodios coinciden', () => {
    const result = withFuture(ready());
    expect(result.issues).toEqual([]);
    expect(result.chapters[1]).toMatchObject({ status: 'ready', levels: EPISODES });
  });

  it('se desbloquea al completar el prólogo y los episodios se abren en orden', () => {
    const entries = [...realEntries().filter((entry) => !EPISODES.includes(entry.id) && !ALIEN_EPISODES.includes(entry.id)), ...futureEntries()];
    const levels = new LevelManager(entries, memoryStorage());
    const built = buildCampaign({ chapters: [prologue, ready()] }, { ...realContext(entries), enemies: { ...catalogs.enemies.enemies, 'omega-7': { boss: true } as never } });
    const campaign = new CampaignManager(built.chapters, levels, built.meta);
    expect(campaign.isChapterUnlocked('station')).toBe(false);
    for (const id of ['forest-1', 'ruins-1', 'ice-1']) campaign.complete(id, { stars: 0, total: 1 });
    const done = campaign.complete('volcano-1', { stars: 0, total: 1 });
    expect(done.unlockedChapters.map((c) => c.id)).toEqual(['station']);
    expect(campaign.episodesOf('station').map((e) => [e.episode.id, e.playable, e.completed])).toEqual([
      ['c1-1-hangar', true, false],
      ['c1-2-corridors', false, false],
      ['c1-3-reactor', false, false],
      ['c1-4-omega', false, false],
    ]);
    const first = campaign.complete('c1-1-hangar', { stars: 2, total: 3 });
    expect(first.next?.id).toBe('c1-2-corridors');
    expect(campaign.episodesOf('station')[1].playable).toBe(true);
    for (const id of ['c1-2-corridors', 'c1-3-reactor']) campaign.complete(id, { stars: 0, total: 3 });
    expect(campaign.complete('c1-4-omega', { stars: 1, total: 3 }).chapterCompleted).toBe(true);
    expect(campaign.progressOf('station')).toMatchObject({ completed: 4, total: 4, stars: 3, starsTotal: 12 });
  });

  it('un episodio con jefe exige un enemigo marcado como jefe en enemies.json', () => {
    const { ['omega-7']: _omega, ...withoutOmega } = catalogs.enemies.enemies;
    expect(withFuture(ready(), withoutOmega).issues.map((i) => i.message).join()).toMatch(/"omega-7" no es un jefe/);
    expect(withFuture(ready(), { ...catalogs.enemies.enemies, 'omega-7': { boss: false } as never }).issues.map((i) => i.message).join()).toMatch(/no es un jefe/);
    expect(withFuture(ready(), { ...catalogs.enemies.enemies, 'magma-king': catalogs.enemies.enemies['magma-king'], 'omega-7': catalogs.enemies.enemies['magma-king'] }).issues).toEqual([]);
  });

  it('"episodes" y "levels" deben coincidir en ids y orden', () => {
    const swapped = (readJson('campaign.json').chapters[1].episodes as unknown[]).slice().reverse();
    expect(withFuture(ready(swapped)).issues.map((i) => i.message).join()).toMatch(/principio de "episodes", en orden/);
    expect(withFuture(ready((readJson('campaign.json').chapters[1].episodes as unknown[]).slice(0, 3))).issues.map((i) => i.message).join()).toMatch(/principio de "episodes", en orden/);
  });

  it('la variante del nivel debe ser la declarada en el episodio', () => {
    const entries = futureEntries();
    (entries[0].data as { variant: string }).variant = 'corridors';
    const result = buildCampaign({ chapters: [prologue, ready()] }, { ...realContext([...realEntries(), ...entries]), enemies: { 'omega-7': { boss: true } } });
    expect(result.issues.map((i) => i.message).join()).toMatch(/c1-1-hangar" no usa la variante "hangar"/);
  });
});

describe('validación de episodios y metadatos', () => {
  const ep = (extra: Record<string, unknown> = {}) => ({ id: 'e-1', title: 'Uno', variant: 'hangar', ...extra });
  const messages = (chapters: unknown[], ctx: Partial<CampaignContext> = {}): string => build(chapters, ctx).issues.map((i) => i.message).join('\n');

  it('acepta episodios válidos y los normaliza', () => {
    const result = build([chapterJson({ plannedLevels: 2, episodes: [ep(), ep({ id: 'e-2', variant: undefined, summary: 'x', boss: 'omega-7' })] })]);
    expect(result.issues).toEqual([]);
    expect(result.chapters[0].episodes).toEqual([
      { id: 'e-1', title: 'Uno', summary: '', variant: 'hangar', boss: null },
      { id: 'e-2', title: 'Uno', summary: 'x', variant: null, boss: 'omega-7' },
    ]);
  });

  it('rechaza episodios mal formados', () => {
    expect(messages([chapterJson({ episodes: 'x' })])).toMatch(/"episodes" debe ser una lista/);
    expect(messages([chapterJson({ episodes: [{ title: 'sin id' }, ep({ id: 'e-2', title: '' })] })])).toMatch(/"id" debe ser un id de nivel[\s\S]*"title" es obligatorio/);
    expect(messages([chapterJson({ episodes: [ep({ id: 'Bad Id' })] })])).toMatch(/"id" debe ser un id/);
    expect(messages([chapterJson({ episodes: [ep({ variant: 5 }), ep({ id: 'e-2', boss: 7 })] })])).toMatch(/"variant" debe ser texto[\s\S]*"boss" debe ser un id/);
  });

  it('la variante debe existir en el bioma del capítulo y exige bioma', () => {
    expect(messages([chapterJson({ plannedLevels: 1, episodes: [ep({ variant: 'sauna' })] })])).toMatch(/variante "sauna" no existe en el bioma "station" \(hangar, corridors, reactor, boss\)/);
    expect(messages([chapterJson({ biome: null, plannedLevels: 1, episodes: [ep()] })])).toMatch(/necesita un "biome" principal/);
    // an unknown biome (planned, not built yet) can't be checked, so its variants are accepted for now
    expect(messages([chapterJson({ biome: 'future-biome', plannedLevels: 1, episodes: [ep({ variant: 'lair' })] })])).toBe('');
  });

  it('los ids de episodio no pueden repetirse ni coincidir con un nivel ya registrado', () => {
    expect(messages([chapterJson({ plannedLevels: 2, episodes: [ep(), ep()] })])).toMatch(/ya lo usa el capítulo "c"/);
    expect(messages([chapterJson({ id: 'a', order: 0, plannedLevels: 1, episodes: [ep()] }), chapterJson({ id: 'b', order: 1, plannedLevels: 1, episodes: [ep()] })])).toMatch(/ya lo usa el capítulo "a"/);
    expect(messages([chapterJson({ plannedLevels: 1, episodes: [ep({ id: 'forest-1' })] })], { levels: realEntries() })).toMatch(/ya existe como nivel registrado/);
  });

  it('"plannedLevels" debe coincidir con el número de episodios', () => {
    expect(messages([chapterJson({ plannedLevels: 4, episodes: [ep()] })])).toMatch(/"plannedLevels" \(4\) debe coincidir con el número de episodios \(1\)/);
  });

  it('un capítulo roto por sus episodios queda como "broken" y no jugable', () => {
    const result = build([chapterJson({ plannedLevels: 1, episodes: [ep({ variant: 'sauna' })] })]);
    expect(result.chapters[0].status).toBe('broken');
  });

  it('los metadatos de campaña son opcionales y se validan', () => {
    expect(build([]).meta).toBeNull();
    const bad = (campaign: unknown): string => buildCampaign({ campaign, chapters: [] }, realContext([])).issues.map((i) => i.message).join();
    expect(bad('x')).toMatch(/debe ser un objeto/);
    expect(bad({ id: 'BAD', title: 'T' })).toMatch(/"id"/);
    expect(bad({ id: 'ok', title: ' ' })).toMatch(/"title" es obligatorio/);
    expect(bad({ id: 'ok', title: 'T', characters: { a: { name: 'A' } } })).toMatch(/necesita id válido, "name" y "role"/);
    expect(bad({ id: 'ok', title: 'T', protagonist: 'ghost' })).toMatch(/personaje inexistente: ghost/);
    expect(buildCampaign({ campaign: { id: 'ok', title: 'T' }, chapters: [] }, realContext([])).meta).toMatchObject({ id: 'ok', protagonist: null, characters: {} });
  });

  it('un campaign.json anterior, sin episodios ni metadatos, sigue siendo válido', () => {
    const old = {
      chapters: [
        { id: 'prologue', name: 'Prologo', order: 0, biome: null, levels: ['forest-1', 'ruins-1', 'ice-1', 'volcano-1'], unlock: null },
        { id: 'station', name: 'Estacion', order: 1, planned: true, plannedLevels: 4, biome: 'station', levels: [], unlock: { chapters: ['prologue'] } },
      ],
    };
    const alienEpisodes = ['c2-1-landing', 'c2-2-caves', 'c2-3-lab', 'c2-4-queen'];
    const result = buildCampaign(old, realContext(realEntries().filter((entry) => !EPISODES.includes(entry.id) && !alienEpisodes.includes(entry.id))));
    expect(result.issues).toEqual([]);
    expect(result.meta).toBeNull();
    expect(result.chapters[1].episodes).toEqual([]);
  });
});

describe('Pasillos de seguridad: integración', () => {
  const raw = readJson('levels/chapter1/02-corridors.json');
  const validation = validateLevel(raw, BIOME_IDS, catalogs.enemies.enemies, BIOME_VARIANTS);
  const parsed = validation.parsed!;
  const size = { width: parsed.width, height: parsed.height };
  const objectCheck = validateObjects(raw.objects, size);
  const objects = objectCheck.objects;
  const story = validateStory(raw.story, size);

  it('carga siete secciones válidas y alcanzables sin habilidades, con checkpoint y coleccionables opcionales', () => {
    expect(validation.issues).toEqual([]);
    expect(validation.ok).toBe(true);
    expect(parsed).toMatchObject({ id: 'c1-2-corridors', biome: 'station', variant: 'corridors', width: 1120, height: 28 });
    expect(raw.sections.map((section: { name: string }) => section.name)).toEqual([
      'Entrada y primer registro', 'Pasillo defensivo', 'Puertas e interruptores',
      'Encuentro blindado', 'Ascenso de mantenimiento', 'Bloqueo de seguridad', 'Sala de registros',
    ]);
    expect(parsed.checkpoints).toEqual([{ col: 626, row: 24 }]);
    expect(parsed.stars).toHaveLength(51);
    expect(parsed.portals).toEqual([{ col: 1108, row: 24 }]);
    expect(validation.reach!.touched.has('1108,24')).toBe(true);
  });

  it('mantiene encuentros deliberados y zonas de descanso sin enemigos', () => {
    expect(raw.sections.map((section: { rows: string[] }) => section.rows.join('').match(/[DTRG]/g)?.length ?? 0)).toEqual([12, 16, 16, 14, 12, 16, 6]);
    expect(parsed.enemies).toHaveLength(92);
    expect(parsed.enemies.every((enemy) => ['drone-scout', 'auto-turret', 'auto-turret-right', 'armored-guardian'].includes(enemy.type))).toBe(true);
    const guardian = parsed.enemies.find((enemy) => enemy.col > 320 && enemy.col < 480 && enemy.type === 'armored-guardian')!;
    expect(catalogs.enemies.enemies[guardian.type].maxHealth).toBe(4);
    const checkpoint = parsed.checkpoints[0];
    for (const enemy of parsed.enemies) {
      const def = catalogs.enemies.enemies[enemy.type];
      const reach = (def.patrol?.range ?? def.patrolRange ?? 0) + (def.patrol?.leash ?? 0) + Math.max(def.detectRange, def.attack!.range) + (def.attack!.kind === 'lunge' ? def.attack!.power * 0.35 : 0);
      expect(Math.hypot((checkpoint.col - enemy.col) * 16, (checkpoint.row - enemy.row) * 16)).toBeGreaterThan(reach);
    }
  });

  it('reutiliza plataformas, láseres, palancas y puertas con referencias válidas y avisos', () => {
    expect(objectCheck.issues).toEqual([]);
    expect(objects.filter((object) => object.type === 'movingPlatform')).toHaveLength(3);
    expect(objects.filter((object) => object.type === 'laser')).toHaveLength(4);
    expect(objects.filter((object) => object.type === 'switch')).toHaveLength(5);
    expect(objects.filter((object) => object.type === 'door')).toHaveLength(5);
    expect(objects.filter((object) => object.type === 'laser').every((laser) => laser.warning >= 0.8 && laser.off >= 1.2)).toBe(true);
    const invalid = structuredClone(raw);
    invalid.objects.find((object: { type: string }) => object.type === 'door').opensWith = 'missing';
    expect(validateObjects(invalid.objects, size).ok).toBe(false);
  });

  it('resuelve ambos circuitos de puertas y anula los láseres sin temporizadores que bloqueen el respawn', () => {
    const bus = new SignalBus();
    const switches = objects.filter((object) => object.type === 'switch');
    expect(switches.every((config) => config.duration === 0)).toBe(true);
    const models = new Map(switches.map((config) => [config.id, new SwitchModel(config.id!, config.duration, bus)]));
    const doors = objects.filter((object) => object.type === 'door');
    const gate = (id: string) => {
      const config = doors.find((door) => door.id === id)!;
      return doorShouldBeOpen(config.opensWith, config.inverted, bus);
    };
    expect(gate('gate-a')).toBe(false);
    models.get('circuit-a')!.activate();
    expect(gate('gate-a')).toBe(true);
    expect(gate('gate-b')).toBe(false);
    models.get('circuit-b')!.activate();
    expect(gate('gate-b')).toBe(true);
    for (const id of ['override-a', 'override-b']) models.get(id)!.activate();
    const lasers = objects.filter((object): object is LaserConfig => object.type === 'laser' && !!object.disabledBy);
    expect(lasers.every((laser) => !hazardEnabled(laser, bus))).toBe(true);
    for (const model of models.values()) model.update(300);
    expect(gate('lockdown-door-b')).toBe(true);
    for (const model of models.values()) model.reset();
    expect(gate('gate-a')).toBe(false);
    expect(lasers.every((laser) => hazardEnabled(laser, bus))).toBe(true);
  });

  it('permite alcanzar las palancas antes de abrir sus propias puertas', () => {
    const supported = withObjectSupport(parsed, objects);
    const reachWith = (signals: readonly string[]) => {
      const bus = new SignalBus();
      for (const signal of signals) bus.set(signal, true);
      const terrain = supported.terrain.map((row) => [...row]);
      for (const door of objects.filter((object) => object.type === 'door')) {
        if (doorShouldBeOpen(door.opensWith, door.inverted, bus)) continue;
        for (let row = door.row; row < door.row + door.height; row++) terrain[row][door.col] = 'stone';
      }
      return analyzeReachability({ ...supported, terrain }).touched;
    };
    expect(reachWith([]).has('368,20')).toBe(true);
    expect(reachWith([]).has('414,24')).toBe(false);
    expect(reachWith(['circuit-a']).has('414,24')).toBe(true);
    expect(reachWith(['circuit-a', 'circuit-b']).has('657,24')).toBe(true);
    expect(reachWith(['circuit-a', 'circuit-b', 'maintenance-power', 'override-a']).has('860,21')).toBe(true);
  });

  it('cuenta la captura y el transporte humano con registros breves y una sala final segura', () => {
    expect(story.issues).toEqual([]);
    expect(story.beats.filter((beat) => beat.blocking).map((beat) => beat.id)).toEqual(['transport-record']);
    expect(story.beats.filter((beat) => !beat.blocking).every((beat) => beat.lines.length === 1)).toBe(true);
    const narrative = story.beats.flatMap((beat) => beat.lines.map((line) => line.text)).join(' ');
    expect(narrative).toMatch(/NÉXAR reprogramaron/);
    expect(narrative).toMatch(/prisioneros humanos.*fuera de la estación/);
    const final = story.beats.find((beat) => beat.id === 'transport-record')!.trigger;
    expect(final.type).toBe('zone');
    if (final.type !== 'zone') return;
    for (const enemy of parsed.enemies) {
      const def = catalogs.enemies.enemies[enemy.type];
      expect((final.col - enemy.col) * 16).toBeGreaterThan(def.detectRange + (def.patrol?.range ?? def.patrolRange ?? 0) + (def.patrol?.leash ?? 0) + 400);
    }
  });

  it('desbloquea el episodio 2 solo tras completar Hangar y mantiene el reactor pendiente', () => {
    const storage = memoryStorage();
    const { campaign } = realCampaign(storage);
    expect(campaign.isLevelUnlocked('c1-1-hangar')).toBe(true);
    expect(campaign.isLevelUnlocked('c1-2-corridors')).toBe(false);
    expect(campaign.episodesOf('station')[1].level?.id).toBe('c1-2-corridors');
    const completion = campaign.complete('c1-1-hangar', { stars: 3, total: 27 });
    expect(completion.next?.id).toBe('c1-2-corridors');
    expect(completion.chapterCompleted).toBe(false);
    const restored = realCampaign(storage).campaign;
    expect(restored.isLevelUnlocked('c1-2-corridors')).toBe(true);
    expect(restored.isLevelCompleted('c1-2-corridors')).toBe(false);
    expect(restored.episodesOf('station')[2]).toMatchObject({ playable: false, completed: false });
    expect(restored.episodesOf('station')[3]).toMatchObject({ playable: false });
    expect(restored.progressOf('prologue').completed).toBe(0);
  });

  it('conserva una partida anterior del Hangar y guarda la victoria de Pasillos abriendo el reactor', () => {
    const storage = memoryStorage();
    const saved = JSON.stringify({ version: 2, best: { 'forest-1': { stars: 7, total: 37 }, 'c1-1-hangar': { stars: 10, total: 27 } } });
    storage.save(saved);
    const { campaign } = realCampaign(storage);
    expect(storage.load()).toBe(saved);
    expect(campaign.isLevelUnlocked('c1-2-corridors')).toBe(true);
    const completed = campaign.complete('c1-2-corridors', { stars: 20, total: 51 });
    expect(completed).toMatchObject({ next: { id: 'c1-3-reactor' }, chapterCompleted: false, unlockedChapters: [] });
    const restored = realCampaign(storage).campaign;
    expect(restored.progressOfLevel('c1-2-corridors')).toEqual({ stars: 20, total: 51 });
    expect(restored.progressOf('station')).toMatchObject({ completed: 2, total: 4, isCompleted: false });
    expect(restored.progressOfLevel('forest-1')).toEqual({ stars: 7, total: 37 });
    expect(restored.progressOfLevel('c1-1-hangar')).toEqual({ stars: 10, total: 27 });
    expect(restored.episodesOf('station')[2]).toMatchObject({ playable: true, completed: false });
    expect(restored.earnedRewards()).toEqual([]);
  });
});

describe('El reactor inestable: integración', () => {
  const raw = readJson('levels/chapter1/03-reactor.json');
  const validation = validateLevel(raw, BIOME_IDS, catalogs.enemies.enemies, BIOME_VARIANTS);
  const parsed = validation.parsed!;
  const size = { width: parsed.width, height: parsed.height };
  const objectCheck = validateObjects(raw.objects, size);
  const objects = objectCheck.objects;
  const story = validateStory(raw.story, size);
  const controls = ['regulator-a', 'regulator-b', 'regulator-c', 'isolate-extraction'];

  it('carga ocho secciones, 64 coleccionables y una salida alcanzable sin habilidades', () => {
    expect(validation.issues).toEqual([]);
    expect(validation.ok).toBe(true);
    expect(parsed).toMatchObject({ id: 'c1-3-reactor', biome: 'station', variant: 'reactor', width: 1600, height: 28 });
    expect(raw.sections.map((section: { name: string }) => section.name)).toEqual([
      'Acceso al reactor', 'Suelos electrificados', 'Transporte sobre conductores', 'Combate de drones',
      'Sala de regulacion', 'Defensas del reactor', 'Sobrecarga del reactor', 'Escape al nucleo de seguridad',
    ]);
    expect(parsed.stars).toHaveLength(64);
    expect(parsed.portals).toEqual([{ col: 1588, row: 24 }]);
    expect(validation.reach!.touched.has('1588,24')).toBe(true);
    expect(parsed.checkpoints).toEqual([{ col: 191, row: 24 }, { col: 790, row: 24 }, { col: 1190, row: 24 }, { col: 1390, row: 24 }]);
  });

  it('combina progresivamente los cinco objetos y conserva ventanas de aviso y refugio', () => {
    expect(objectCheck.issues).toEqual([]);
    for (const [type, count] of [['electricFloor', 13], ['movingPlatform', 6], ['laser', 5], ['switch', 4], ['door', 5]] as const) {
      expect(objects.filter((object) => object.type === type)).toHaveLength(count);
    }
    const hazards = objects.filter((object) => object.type === 'laser' || object.type === 'electricFloor').sort((first, second) => first.col - second.col);
    expect(hazards.every((hazard) => hazard.warning >= 0.9 && hazard.off >= 1.3 && hazard.damage === 1)).toBe(true);
    for (let index = 1; index < hazards.length; index++) {
      const previous = hazards[index - 1];
      const end = previous.col + (previous.type === 'electricFloor' ? previous.width : 1);
      expect(hazards[index].col - end).toBeGreaterThanOrEqual(8);
    }
    expect(raw.sections.map((section: { rows: string[] }) => section.rows.join('').match(/[DNTRGEJH]/g)?.length ?? 0)).toEqual([13, 14, 15, 13, 12, 14, 11, 8]);
    expect(parsed.enemies).toHaveLength(100);
  });

  it('protege los checkpoints y el anuncio final de enemigos y peligros inevitables', () => {
    const hazards = objects.filter((object) => object.type === 'laser' || object.type === 'electricFloor');
    for (const checkpoint of parsed.checkpoints) {
      for (const enemy of parsed.enemies) {
        const def = catalogs.enemies.enemies[enemy.type];
        const reach = Math.max(def.detectRange, def.attack?.range ?? 0) + (def.patrol?.range ?? def.patrolRange ?? 0) + (def.patrol?.leash ?? 0) + (def.attack?.kind === 'lunge' ? def.attack.power * 0.35 : 0);
        expect(Math.hypot((checkpoint.col - enemy.col) * 16, (checkpoint.row - enemy.row) * 16)).toBeGreaterThan(reach);
      }
      expect(hazards.every((hazard) => checkpoint.col < hazard.col - 8 || checkpoint.col > hazard.col + (hazard.type === 'electricFloor' ? hazard.width : 1) + 8)).toBe(true);
    }
    const terminal = story.beats.find((beat) => beat.id === 'omega-protocol')!.trigger;
    if (terminal.type !== 'zone') throw new Error('Missing terminal zone');
    for (const enemy of parsed.enemies) {
      const def = catalogs.enemies.enemies[enemy.type];
      expect((terminal.col - enemy.col) * 16).toBeGreaterThan(def.detectRange + (def.patrol?.range ?? def.patrolRange ?? 0) + (def.patrol?.leash ?? 0) + 400);
    }
  });

  it('conserva los encuentros de introduccion y exige plataformas para el encuentro final reforzado', () => {
    const introductions = parsed.enemies.filter((enemy) => enemy.col >= 200 && enemy.col < 300);
    const electric = introductions.find((enemy) => enemy.col === 225 && enemy.type === 'electric-drone')!;
    const technician = introductions.find((enemy) => enemy.col === 278 && enemy.type === 'nexar-technician')!;
    expect(electric).toBeDefined();
    expect(technician).toBeDefined();
    expect((technician.col - electric.col) * 16).toBeGreaterThan(2 * 112 + 40);
    const escape = parsed.enemies.filter((enemy) => enemy.col >= 1400);
    expect(escape).toHaveLength(8);
    expect(new Set(escape.map((enemy) => enemy.type))).toEqual(new Set(['electric-drone', 'drone-sentinel', 'drone-scout', 'nexar-technician', 'armored-guardian']));
    const bus = new SignalBus();
    controls.forEach((id) => bus.set(id, true));
    const escapeHazards = objects.filter((object): object is LaserConfig | ElectricFloorConfig => (object.type === 'laser' || object.type === 'electricFloor') && object.col >= 1400);
    expect(escapeHazards.every((hazard) => hazardEnabled(hazard, bus))).toBe(true);
    const fromEscape = { ...parsed, spawn: { col: 1408, row: 24 } };
    const missingLift = objects.filter((object) => object.id !== 'escape-lift');
    expect(analyzeReachability(withObjectSupport(fromEscape, missingLift)).touched.has('1588,24')).toBe(false);
    expect(analyzeReachability(withObjectSupport(fromEscape, objects)).touched.has('1588,24')).toBe(true);
  });

  it('los reguladores y el aislamiento abren puertas y detienen la extracción de verdad', () => {
    const bus = new SignalBus();
    const switches = objects.filter((object) => object.type === 'switch');
    expect(switches.map((config) => config.id)).toEqual(controls);
    expect(switches.every((config) => config.duration === 0)).toBe(true);
    const models = new Map(switches.map((config) => [config.id, new SwitchModel(config.id!, config.duration, bus)]));
    const gates = objects.filter((object) => object.type === 'door');
    const opened = (id: string) => {
      const gate = gates.find((door) => door.id === id)!;
      return doorShouldBeOpen(gate.opensWith, gate.inverted, bus);
    };
    expect(opened('stabilized-gate')).toBe(false);
    models.get('regulator-a')!.activate();
    expect(opened('regulator-door-a')).toBe(true);
    expect(opened('regulator-door-b')).toBe(false);
    models.get('regulator-b')!.activate();
    expect(opened('regulator-door-b')).toBe(true);
    models.get('regulator-c')!.activate();
    expect(opened('regulator-door-c')).toBe(true);
    expect(opened('stabilized-gate')).toBe(false);
    models.get('isolate-extraction')!.activate();
    expect(opened('stabilized-gate')).toBe(true);
    expect(opened('security-access')).toBe(true);
    const controlledHazards = objects.filter((object): object is LaserConfig | ElectricFloorConfig => (object.type === 'laser' || object.type === 'electricFloor') && !!object.disabledBy);
    expect(controlledHazards.every((hazard) => !hazardEnabled(hazard, bus))).toBe(true);
    for (const model of models.values()) model.update(900);
    expect(opened('security-access')).toBe(true);
    for (const model of models.values()) model.reset();
    expect(opened('security-access')).toBe(false);
  });

  it('no permite saltarse la regulación ni entrar al escape sin aislar la extracción', () => {
    const supported = withObjectSupport(parsed, objects);
    const reachWith = (signals: readonly string[]) => {
      const bus = new SignalBus();
      for (const signal of signals) bus.set(signal, true);
      const terrain = supported.terrain.map((row) => [...row]);
      for (const door of objects.filter((object) => object.type === 'door')) {
        if (doorShouldBeOpen(door.opensWith, door.inverted, bus)) continue;
        for (let row = door.row; row < door.row + door.height; row++) terrain[row][door.col] = 'stone';
      }
      return analyzeReachability({ ...supported, terrain }).touched;
    };
    const closed = reachWith([]);
    expect(closed.has('836,20')).toBe(true);
    expect(closed.has('886,24')).toBe(false);
    const first = reachWith(['regulator-a']);
    expect(first.has('886,24')).toBe(true);
    expect(first.has('960,20')).toBe(false);
    expect(reachWith(['regulator-a', 'regulator-b']).has('960,20')).toBe(true);
    const regulated = reachWith(controls.slice(0, 3));
    expect(regulated.has('1338,20')).toBe(true);
    expect(regulated.has('1372,24')).toBe(false);
    expect(regulated.has('1588,24')).toBe(false);
    expect(reachWith(controls).has('1588,24')).toBe(true);
  }, 15000);

  it('continúa la historia de Pasillos y termina con el anuncio exacto de LUMA', () => {
    expect(story.issues).toEqual([]);
    expect(story.beats.filter((beat) => beat.blocking).map((beat) => beat.id)).toEqual(['omega-protocol']);
    const text = story.beats.flatMap((beat) => beat.lines.map((line) => line.text)).join(' ');
    expect(text).toMatch(/Pasillos/);
    expect(text).toMatch(/energía para transportar prisioneros/);
    const director = new StoryDirector(story.beats, false);
    director.checkZones({ x: 1556 * 16, y: 24 * 16, width: 12, height: 22 });
    expect(director.blocking).toBe(true);
    expect(director.view?.text).toBe('Protocolo OMEGA activado. Unidad de defensa OMEGA-7 en funcionamiento');
  });

  it('desbloquea el reactor tras Pasillos sin completar automáticamente ningún episodio', () => {
    const storage = memoryStorage();
    const { campaign } = realCampaign(storage);
    expect(campaign.episodesOf('station')[2].level?.id).toBe('c1-3-reactor');
    expect(campaign.isLevelUnlocked('c1-3-reactor')).toBe(false);
    campaign.complete('c1-1-hangar', { stars: 0, total: 27 });
    expect(campaign.isLevelUnlocked('c1-3-reactor')).toBe(false);
    const result = campaign.complete('c1-2-corridors', { stars: 0, total: 51 });
    expect(result.next?.id).toBe('c1-3-reactor');
    const restored = realCampaign(storage).campaign;
    expect(restored.isLevelUnlocked('c1-3-reactor')).toBe(true);
    expect(restored.isLevelCompleted('c1-3-reactor')).toBe(false);
    expect(restored.isLevelUnlocked('c1-4-omega')).toBe(false);
    expect(restored.progressOf('prologue').completed).toBe(0);
  });

  it('conserva las partidas de Pasillos y persiste la victoria sin inventar el episodio de OMEGA', () => {
    const storage = memoryStorage();
    const saved = JSON.stringify({ version: 2, best: { 'c1-1-hangar': { stars: 4, total: 27 }, 'c1-2-corridors': { stars: 8, total: 51 } } });
    storage.save(saved);
    const { campaign } = realCampaign(storage);
    expect(storage.load()).toBe(saved);
    expect(campaign.isLevelUnlocked('c1-3-reactor')).toBe(true);
    const completion = campaign.complete('c1-3-reactor', { stars: 23, total: 64 });
    expect(completion).toMatchObject({ next: { id: 'c1-4-omega' }, chapterCompleted: false, unlockedChapters: [] });
    const restored = realCampaign(storage).campaign;
    expect(restored.progressOfLevel('c1-1-hangar')).toEqual({ stars: 4, total: 27 });
    expect(restored.progressOfLevel('c1-2-corridors')).toEqual({ stars: 8, total: 51 });
    expect(restored.progressOfLevel('c1-3-reactor')).toEqual({ stars: 23, total: 64 });
    expect(restored.progressOf('station')).toMatchObject({ completed: 3, total: 4, isCompleted: false });
    expect(restored.episodesOf('station')[3]).toMatchObject({ playable: true, completed: false });
    expect(restored.earnedRewards()).toEqual([]);
  });
});

describe('Protocolo OMEGA: episodio y cierre de capítulo', () => {
  const raw = readJson('levels/chapter1/04-omega.json');
  const validation = validateLevel(raw, BIOME_IDS, catalogs.enemies.enemies, BIOME_VARIANTS);
  const parsed = validation.parsed!;
  const story = validateStory(raw.story, { width: parsed.width, height: parsed.height });
  const checked = validateBossEncounter(raw.bossEncounter, parsed, story.beats, catalogs.enemies.enemies);
  const encounter = checked.encounter!;
  const objects = validateObjects(raw.objects, { width: parsed.width, height: parsed.height, externalSignals: Object.values(encounter.signals) });

  it('valida nivel, recursos, jefe único y señales reales del escenario', () => {
    expect(validation.issues).toEqual([]);
    expect(validation.ok).toBe(true);
    expect(checked.issues).toEqual([]);
    expect(objects.issues).toEqual([]);
    expect(parsed).toMatchObject({ id: 'c1-4-omega', biome: 'station', variant: 'boss', width: 740 });
    expect(parsed.enemies.filter((enemy) => enemy.type === 'omega-7')).toEqual([{ col: 650, row: 24, type: 'omega-7' }]);
    expect(catalogs.enemies.enemies['omega-7']).toMatchObject({ boss: true, healthBar: true, maxHealth: 20, armor: 0 });
    expect(parsed.checkpoints).toEqual([{ col: 629, row: 24 }]);
    expect(parsed.portals).toEqual([{ col: 730, row: 24 }]);
    const hazards = objects.objects.filter((object): object is LaserConfig | ElectricFloorConfig => (object.type === 'laser' || object.type === 'electricFloor') && object.enabledBy === encounter.signals.hazards);
    expect(hazards).toHaveLength(4);
    expect(hazards.every((hazard) => hazard.warning >= 0.9 && hazard.damage === 1)).toBe(true);
    const bus = new SignalBus();
    expect(hazards.every((hazard) => !hazardEnabled(hazard, bus))).toBe(true);
    bus.set(encounter.signals.hazards, true);
    expect(hazards.every((hazard) => hazardEnabled(hazard, bus))).toBe(true);
    bus.set(encounter.signals.hazards, false);
    expect(hazards.every((hazard) => !hazardEnabled(hazard, bus))).toBe(true);
  });

  it('mantiene checkpoint y refugios fuera de la aproximación enemiga', () => {
    const checkpoint = parsed.checkpoints[0];
    for (const enemy of parsed.enemies.filter((entry) => entry.col < encounter.arena.col)) {
      const def = catalogs.enemies.enemies[enemy.type];
      const range = def.detectRange + (def.patrol?.range ?? def.patrolRange ?? 0) + (def.patrol?.leash ?? 0) + 400;
      expect((checkpoint.col - enemy.col) * 16).toBeGreaterThan(range);
    }
    const arenaHazards = objects.objects.filter((object) => (object.type === 'laser' || object.type === 'electricFloor') && object.enabledBy === encounter.signals.hazards);
    expect(arenaHazards.every((hazard) => hazard.col < 645 || hazard.col >= 657)).toBe(true);
    expect(parsed.terrain[22][645]).toBe('oneway');
    expect(parsed.terrain[22][654]).toBe('oneway');
  });

  it('mantiene la arena de veinte casillas con suelo continuo y sus dos enemigos previstos', () => {
    const arena = raw.sections.find((section: { name: string }) => section.name === 'Arena OMEGA-7')!;
    expect(Math.max(...arena.rows.map((row: string) => row.length))).toBe(encounter.arena.width);
    expect(parsed.enemies.filter((enemy) => enemy.col >= 640 && enemy.col < 660).map((enemy) => enemy.type)).toEqual(['omega-7', 'sentenio-001']);
    expect(parsed.enemies.filter((enemy) => enemy.col >= 660)).toEqual([]);
    for (let col = 640; col < 660; col++) {
      for (let row = 25; row < parsed.height; row++) expect(parsed.terrain[row][col]).toBe('ground');
    }
  });

  it('reconoce la armadura y cuenta la derrota mediante los diálogos existentes', () => {
    const director = new StoryDirector(story.beats, false);
    director.start();
    director.trigger(encounter.intro);
    expect(director.blocking).toBe(true);
    expect(director.view?.text).toMatch(/Armadura PIEZOD.*no fue accidental/);
    while (director.blocking) { director.advance(); director.advance(); }
    director.trigger(encounter.victory);
    const ending = story.beats.find((beat) => beat.id === encounter.victory)!;
    expect(ending.lines.some((line) => line.text === 'PIEZOD... tú ya estuviste allí. Ellos te estaban esperando')).toBe(true);
    expect(ending.lines[0].text).toMatch(/coordenadas del planeta/);
    expect(ending.lines.at(-1)!.text).toMatch(/Capítulo 2.*Próximamente/);
  });

  it('desbloquea OMEGA solo con Reactor y al completarlo abre el capítulo alien publicado', () => {
    const storage = memoryStorage();
    const { campaign } = realCampaign(storage);
    expect(campaign.availableChapters().map((chapter) => chapter.id)).toEqual(['prologue', 'station']);
    expect(campaign.isLevelUnlocked('c1-4-omega')).toBe(false);
    for (const id of EPISODES.slice(0, 2)) campaign.complete(id, { stars: 0, total: realEntries().find((entry) => entry.id === id)!.validation.parsed!.stars.length });
    expect(campaign.isLevelUnlocked('c1-4-omega')).toBe(false);
    expect(campaign.complete('c1-3-reactor', { stars: 0, total: 64 }).next?.id).toBe('c1-4-omega');
    expect(campaign.isLevelUnlocked('c1-4-omega')).toBe(true);
    const done = campaign.complete('c1-4-omega', { stars: 4, total: parsed.stars.length });
    expect(done).toMatchObject({ chapterCompleted: true, next: undefined, unlockedChapters: [expect.objectContaining({ id: 'alien' })] });
    const restored = realCampaign(storage).campaign;
    expect(restored.progressOf('station')).toMatchObject({ completed: 4, total: 4, isCompleted: true });
    expect(restored.progressOfLevel('c1-4-omega')?.stars).toBe(4);
    expect(restored.chapter('alien')?.status).toBe('ready');
    expect(restored.isChapterUnlocked('alien')).toBe(true);
    expect(restored.earnedRewards()).toEqual([]);
    expect(restored.progressOf('prologue').completed).toBe(0);
  });
});

describe('Capitulo 1: densidad y espacio de combate', () => {
  it.each([
    ['c1-1-hangar', 24, 24, [4, 6, 2, 2, 6, 4]],
    ['c1-2-corridors', 92, 92, [12, 16, 16, 14, 12, 16, 6]],
    ['c1-3-reactor', 100, 100, [13, 14, 15, 13, 12, 14, 11, 8]],
    ['c1-4-omega', 125, 125, [30, 32, 29, 32, 2, 0]],
  ] as const)('%s mantiene densidad acotada, refugios y espacio para flanquear', (id, minimum, maximum, sections) => {
    const entry = realEntries().find((level) => level.id === id)!;
    const level = entry.validation.parsed!;
    const raw = entry.data!;
    expect(level.enemies.length).toBeGreaterThanOrEqual(minimum);
    expect(level.enemies.length).toBeLessThanOrEqual(maximum);
    expect(raw.sections.map((section) => section.rows.join('').split('').filter((symbol) => raw.enemies?.[symbol]).length)).toEqual(sections);
    for (const enemy of level.enemies) {
      const densityLimit = id === 'c1-4-omega' ? 8 : id === 'c1-3-reactor' ? 5 : 4;
      expect(level.enemies.filter((other) => Math.abs(other.col - enemy.col) <= 10).length).toBeLessThanOrEqual(densityLimit);
      const def = catalogs.enemies.enemies[enemy.type];
      const reach = Math.max(def.detectRange, def.attack?.range ?? 0) + (def.patrol?.range ?? def.patrolRange ?? 0) + (def.patrol?.leash ?? 0) + (def.attack?.kind === 'lunge' ? def.attack.power * 0.35 : 0);
      for (const refuge of def.boss ? [] : [level.spawn!, ...level.checkpoints]) {
        expect(Math.hypot((refuge.col - enemy.col) * 16, (refuge.row - enemy.row) * 16)).toBeGreaterThan(reach);
      }
      if (enemy.type !== 'armored-guardian') continue;
      for (let offset = -6; offset <= 6; offset++) {
        expect(['ground', 'stone']).toContain(level.terrain[enemy.row + 1][enemy.col + offset]);
        for (let height = 0; height <= 3; height++) {
          expect(['ground', 'stone']).not.toContain(level.terrain[enemy.row - height][enemy.col + offset]);
        }
      }
      const doors = validateObjects(raw.objects, { width: level.width, height: level.height, externalSignals: id === 'c1-4-omega' ? ['omega-engaged', 'omega-hazards', 'omega-defeated'] : [] }).objects.filter((object) => object.type === 'door');
      expect(doors.every((door) => Math.abs(door.col - enemy.col) > 6)).toBe(true);
    }
    if (id === 'c1-4-omega') {
      expect(level.enemies.filter((enemy) => enemy.col >= 640 && enemy.col < 660).map((enemy) => enemy.type)).toEqual(['omega-7', 'sentenio-001']);
    }
  });
});

describe('Hangar: nivel, drones y narrativa', () => {
  const raw = readJson('levels/chapter1/01-hangar.json');
  const validation = validateLevel(raw, BIOME_IDS, catalogs.enemies.enemies, BIOME_VARIANTS);
  const size = { width: 380, height: 24 };
  const story = validateStory(raw.story, size);
  const director = (touch = false) => new StoryDirector(story.beats, touch);

  it('tiene seis secciones válidas, meta, checkpoints y los dos tipos de dron', () => {
    expect(catalogs.issues).toEqual([]);
    expect(validation.issues).toEqual([]);
    expect(validation.ok).toBe(true);
    expect(raw.sections).toHaveLength(6);
    expect(validation.parsed).toMatchObject({ width: 380, height: 24 });
    expect(validation.parsed!.stars).toHaveLength(27);
    expect(validation.parsed!.checkpoints).toHaveLength(2);
    expect(validation.parsed!.portals).toHaveLength(1);
    expect(validation.parsed!.enemies).toHaveLength(24);
    expect(new Set(validation.parsed!.enemies.map((enemy) => enemy.type))).toEqual(new Set(['drone-scout', 'drone-sentinel']));
  });

  it('mantiene los drones dentro del nivel, entre techo y suelo y fuera del terreno', () => {
    const level = validation.parsed!;
    for (const enemy of level.enemies) {
      expect(enemy.col).toBeGreaterThan(0);
      expect(enemy.col).toBeLessThan(level.width - 1);
      expect(enemy.row).toBeGreaterThan(0);
      expect(enemy.row).toBeLessThan(level.height - 3);
      expect(level.terrain[enemy.row][enemy.col]).toBeNull();
      expect(level.terrain[enemy.row - 1][enemy.col]).toBeNull();
      expect(level.terrain.slice(0, enemy.row).some((row) => row[enemy.col] === 'stone')).toBe(true);
      expect(level.terrain.slice(enemy.row + 1).some((row) => row[enemy.col] === 'ground' || row[enemy.col] === 'stone')).toBe(true);
    }
  });

  it('resuelve plataformas, peligros e interruptor sin referencias inexistentes', () => {
    const objects = validateObjects(raw.objects, size);
    expect(objects.issues).toEqual([]);
    expect(objects.objects.filter((object) => object.type === 'movingPlatform')).toHaveLength(3);
    expect(objects.objects.filter((object) => object.type === 'laser')).toHaveLength(3);
    expect(objects.objects.filter((object) => object.type === 'electricFloor')).toHaveLength(1);
    expect(objects.objects.filter((object) => object.type === 'switch')).toHaveLength(1);
    expect(objects.objects.filter((object) => object.type === 'door')).toHaveLength(2);
    const broken = structuredClone(raw);
    broken.objects.find((object: { type: string }) => object.type === 'door').opensWith = ['missing-switch'];
    expect(validateLevel(broken, BIOME_IDS, catalogs.enemies.enemies, BIOME_VARIANTS).ok).toBe(false);
  });

  it('alterna seis encuentros y deja descanso antes de la terminal', () => {
    expect(raw.sections.map((section: { rows: string[] }) => section.rows.join('').match(/[DN]/g) ?? [])).toEqual([
      ['N', 'D', 'D', 'D'], ['N', 'D', 'N', 'D', 'D', 'D'], ['N', 'D'], ['D', 'N'], ['D', 'D', 'D', 'N', 'D', 'D'], ['N', 'D', 'D', 'N'],
    ]);
    const terminal = story.beats.find((beat) => beat.id === 'terminal')!.trigger;
    expect(terminal.type).toBe('zone');
    if (terminal.type !== 'zone') return;
    for (const enemy of validation.parsed!.enemies) {
      const def = catalogs.enemies.enemies[enemy.type];
      const reach = def.patrol!.range + def.patrol!.leash + Math.max(def.detectRange, def.attack!.range);
      expect((terminal.col - enemy.col) * 16).toBeGreaterThan(reach);
    }
    const ambient = story.beats.filter((beat) => !beat.blocking);
    expect(ambient.every((beat) => beat.lines.length === 1 && beat.lines[0].text.length < 110)).toBe(true);
    expect(story.beats.filter((beat) => beat.blocking).map((beat) => beat.id)).toEqual(['terminal']);
    expect(story.beats.find((beat) => beat.id === 'wake')!.lines[0].text).toMatch(/estación espacial.*tripulación/);
    expect(story.beats.find((beat) => beat.id === 'human-fragment')!.lines[0].text).toMatch(/supervivientes/);
    expect(story.beats.find((beat) => beat.id === 'terminal')!.lines.some((line) => line.text.includes('Núcleo'))).toBe(true);
  });

  it('los drones usan el combate existente con aviso, salto y vulnerabilidad a armas', () => {
    const scout = catalogs.enemies.enemies['drone-scout'];
    const sentinel = catalogs.enemies.enemies['drone-sentinel'];
    expect(scout).toMatchObject({ movement: 'hover', stomp: 'kill', maxHealth: 1, attack: { kind: 'lunge', telegraph: 0.65 } });
    expect(sentinel).toMatchObject({ movement: 'hover', stomp: 'damage', maxHealth: 3, attack: { kind: 'shoot', telegraph: 0.8 } });
    expect(scout.speed).toBeGreaterThan(sentinel.speed * 2);
    expect(scout.patrol!.range).toBeLessThanOrEqual(32);
    expect(sentinel.attack!.cooldown).toBeGreaterThan(3);
    expect(sentinel.resist.laser).toBe(0.5);
    for (const enemy of [scout, sentinel]) {
      const snapshot = { dead: false, hurtTime: 0, attackTime: 0, distance: Infinity, attackReady: true };
      expect(nextAiState(enemy, snapshot)).toBe('patrol');
      expect(nextAiState(enemy, { ...snapshot, distance: 20 })).toBe('attack');
      expect(nextAiState(enemy, { ...snapshot, distance: 20, attackReady: false })).toBe('chase');
      expect(enemy.immune).toEqual([]);
    }
    expect(['beam', 'flamethrower', 'laser-cannon'].every((id) => !!catalogs.abilities.abilities[id])).toBe(true);
  });

  it('el vuelo cambia de sentido en los límites y el perseguidor respeta su zona', () => {
    const zone = { range: 64, bob: 6, leash: 32 };
    const home = { x: 100, y: 100 };
    expect(hoverPatrol({ x: 164, y: 100 }, home, zone, 40, 1, 0)).toMatchObject({ vx: -40, dir: -1 });
    expect(hoverPatrol({ x: 36, y: 100 }, home, zone, 40, -1, 0)).toMatchObject({ vx: 40, dir: 1 });
    expect(leashedChase({ x: 196, y: 138 }, { x: 300, y: 300 }, home, zone, 40)).toEqual({ vx: 0, vy: 0 });
    const velocity = lungeVelocity(home, { x: 130, y: 140 }, 150);
    expect(Math.hypot(velocity.vx, velocity.vy)).toBeCloseTo(150);
    expect(telegraphOn(0)).toBe(true);
    expect(telegraphOn(0.1)).toBe(false);
  });

  it('el centinela se retira, mantiene distancia o se acerca sin abandonar su zona', () => {
    const zone = { range: 24, bob: 4, leash: 32, standoff: 96 };
    const home = { x: 200, y: 100 };
    expect(leashedChase(home, { x: 230, y: 100 }, home, zone, 22).vx).toBe(-22);
    expect(leashedChase(home, { x: 296, y: 100 }, home, zone, 22)).toEqual({ vx: 0, vy: 0 });
    expect(leashedChase(home, { x: 330, y: 100 }, home, zone, 22).vx).toBe(22);
    expect(leashedChase({ x: 144, y: 100 }, { x: 160, y: 100 }, home, zone, 22).vx).toBe(0);
    const scout = { range: 28, bob: 5, leash: 24 };
    expect(leashedChase(home, { x: 230, y: 100 }, home, scout, 56).vx).toBe(56);
  });

  it('el rayo básico derrota ambos drones sin mejoras ni alterar resistencias', () => {
    const beam = catalogs.abilities.abilities.beam;
    const level = beam.levels[0];
    for (const id of ['drone-scout', 'drone-sentinel']) {
      const enemy = catalogs.enemies.enemies[id];
      const hit = { amount: level.params.damage, form: 'projectile' as const, element: beam.element };
      const damage = computeDamage(hit, enemy, catalogs.chart);
      expect(damage).toBeGreaterThan(0);
      const shots = Math.ceil(enemy.maxHealth / damage);
      expect(shots * level.energy).toBeLessThanOrEqual(100);
      const health = new Health(enemy.maxHealth);
      for (let index = 0; index < shots; index++) health.apply(hit, enemy, catalogs.chart);
      expect(health.isDead).toBe(true);
    }
  });

  it('valida todos los momentos y rechaza zonas o textos incompletos', () => {
    expect(story.issues).toEqual([]);
    expect(story.beats.find((beat) => beat.id === 'terminal')).toMatchObject({ blocking: true, trigger: { type: 'zone' } });
    const invalid = { beats: [{ id: 'bad', trigger: { type: 'zone', col: 379, row: 20, width: 4, height: 7 }, lines: [{ speaker: 'luma', text: '' }] }] };
    expect(validateStory(invalid, size).issues.map((issue) => issue.message).join()).toMatch(/zona se sale del nivel/);
    expect(validateStory(invalid, size).ok).toBe(false);
    expect(validateStory(undefined, size)).toEqual({ beats: [], issues: [], ok: true });
  });

  it('LUMA escribe progresivamente, adapta el texto táctil y no repite zonas', () => {
    const desktop = director();
    const touch = director(true);
    for (const instance of [desktop, touch]) {
      instance.checkZones({ x: 10 * 16, y: 20 * 16, width: 12, height: 20 });
      expect(instance.view?.beatId).toBe('tutorial-move');
      instance.update(0.1);
      expect(instance.view?.shown.length).toBe(Math.floor(0.1 * TYPE_SPEED));
    }
    expect(desktop.view?.text).toMatch(/ESPACIO/);
    expect(touch.view?.text).toMatch(/pantalla/);
    desktop.advance();
    expect(desktop.view?.typed).toBe(true);
    desktop.advance();
    desktop.checkZones({ x: 0, y: 0, width: 12, height: 20 });
    desktop.checkZones({ x: 10 * 16, y: 20 * 16, width: 12, height: 20 });
    expect(desktop.active).toBe(false);
  });

  it('la terminal interrumpe mensajes ambientales y bloquea hasta terminar la transmisión', () => {
    const instance = director();
    instance.start();
    expect(instance.view?.beatId).toBe('wake');
    instance.checkZones({ x: 366 * 16, y: 20 * 16, width: 12, height: 20 });
    expect(instance.view?.beatId).toBe('terminal');
    expect(instance.pendingBlocking).toBe(true);
    const lines = instance.view!.lineCount;
    for (let index = 0; index < lines; index++) {
      expect(instance.blocking).toBe(true);
      instance.advance();
      expect(instance.view?.typed).toBe(true);
      instance.advance();
    }
    expect(instance.pendingBlocking).toBe(false);
    expect(instance.view?.beatId).toBe('wake');
    expect(instance.trigger('terminal')).toBe(false);
  });

  it('permite terminar diálogos sin pulsaciones y reiniciarlos con el nivel', () => {
    const instance = director();
    instance.trigger('terminal');
    for (let index = 0; index < 5; index++) instance.update(30);
    expect(instance.active).toBe(false);
    instance.reset();
    expect(instance.hasPlayed('terminal')).toBe(false);
    instance.start();
    expect(instance.view?.beatId).toBe('wake');
  });
});

describe('bioma de la estación y sus variantes', () => {
  it('el Hangar usa tecnología decorativa sustituible sin cambiar los frames originales', () => {
    const theme = getBiome('station', 'hangar');
    expect(theme.decorationTypes.map((decoration) => decoration.frame)).toEqual([DECO.emergency, DECO.console, DECO.capsule, DECO.container, DECO.alienTech, DECO.wallPanel]);
    expect(theme.decorationTypes.every((decoration) => !decoration.foreground)).toBe(true);
    expect(theme.signFrame).toBe(DECO.console);
    expect(BIOMES.forest.signFrame).toBe(14);
    expect(DECO.bush).toBe(15);
    expect(DECO_FRAME_COUNT).toBe(24);
    expect(STATION_DEFINITION.variants!.hangar.files).toBeUndefined();
  });

  it('existe con las cuatro variantes que usan los episodios', () => {
    expect(BIOME_VARIANTS.station).toEqual(['hangar', 'corridors', 'reactor', 'boss']);
    expect(Object.keys(BIOMES.station.variants)).toEqual(['hangar', 'corridors', 'reactor', 'boss']);
    for (const variant of BIOME_VARIANTS.station) {
      const theme = getBiome('station', variant);
      expect(theme).toMatchObject({ id: `station/${variant}`, baseId: 'station', variant });
      expect(theme.assets).toHaveLength(9);
    }
    expect(BIOME_THEMES.map((t) => t.id)).toEqual(expect.arrayContaining(['station', 'station/hangar', 'station/corridors', 'station/reactor', 'station/boss']));
  });

  it('hangar y pasillos reutilizan las texturas del bioma base; reactor y jefe generan las suyas', () => {
    for (const shared of ['hangar', 'corridors'] as const) {
      expect(ownedParts(STATION_DEFINITION, STATION_DEFINITION.variants![shared]).size).toBe(0);
      const theme = getBiome('station', shared);
      expect(theme.assets.map((a) => a.key)).toEqual(BIOMES.station.assets.map((a) => a.key));
      expect(theme.tileset).toBe('platformer.biome.station.tiles');
    }
    for (const own of ['reactor', 'boss'] as const) {
      expect(ownedParts(STATION_DEFINITION, STATION_DEFINITION.variants![own]).size).toBe(9);
      expect(getBiome('station', own).tileset).toBe(`platformer.biome.station.${own}.tiles`);
    }
  });

  it('cada variante tiene su propia identidad visual (iluminación, color y partículas)', () => {
    const themes = ['hangar', 'corridors', 'reactor', 'boss'].map((v) => getBiome('station', v));
    expect(new Set(themes.map((t) => JSON.stringify(t.lighting))).size).toBe(4);
    expect(new Set(themes.map((t) => t.accentColor)).size).toBeGreaterThanOrEqual(3);
    expect(themes[1].ambient).not.toEqual(BIOMES.station.ambient);
    expect(themes[3].backgroundColor).not.toBe(BIOMES.station.backgroundColor);
  });

  it('todas las claves de textura de los temas de la estación son únicas por tema y siguen la convención de nombres', () => {
    for (const theme of BIOME_THEMES.filter((t) => t.baseId === 'station')) {
      expect(theme.assets.every((a) => a.key.startsWith('platformer.biome.station.'))).toBe(true);
      expect(new Set(theme.assets.map((a) => a.key)).size).toBe(9);
    }
  });

  it('está preparada para PNG: carpetas de assets y soporte de "files" en base y variantes', () => {
    for (const part of ['tilesets', 'backgrounds', 'decorations']) expect(() => readFileSync(join(ASSETS, `biomes/station/${part}/.gitkeep`))).not.toThrow();
    expect(STATION_DEFINITION.files).toBeUndefined();
    expect([...ownedParts(STATION_DEFINITION, { files: { tiles: 'assets/platformer/biomes/station/tilesets/hangar.png' } })]).toEqual(['tiles']);
  });

  it('un nivel puede usar el bioma station y una variante; las inexistentes se rechazan', () => {
    const level = (variant?: string) => ({
      id: 'probe',
      name: 'Probe',
      biome: 'station',
      ...(variant ? { variant } : {}),
      height: 12,
      sections: [{ rows: ['.P........', '##########', '##########'] }, { rows: ['..........', '##########', '##########'] }, { rows: ['.........O', '##########', '##########'] }],
    });
    const errors = (raw: unknown) => validateLevel(raw, BIOME_IDS, catalogs.enemies.enemies, BIOME_VARIANTS).issues.filter((i) => i.severity === 'error');
    expect(errors(level())).toEqual([]);
    expect(errors(level('reactor'))).toEqual([]);
    expect(errors(level('sauna'))[0].message).toMatch(/hangar, corridors, reactor, boss/);
  });
});
