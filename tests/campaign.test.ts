import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Geom: { Rectangle: class {} }, Input: { Keyboard: { KeyCodes: {} } } } }));

import { BIOME_THEMES, BIOME_VARIANTS, BIOMES, getBiome } from '../src/games/platformer/biomes';
import { ICE_DEFINITION } from '../src/games/platformer/biomes/definitions/ice';
import { createBiome, ownedParts, resolveVariant } from '../src/games/platformer/biomes/createBiome';
import { PlatformerScenes } from '../src/games/platformer/config';
import { buildCampaign, CampaignManager, type ChapterDef } from '../src/games/platformer/level/CampaignManager';
import { chapterCards, defaultChapterId, gridCenters, levelCards, moveSelection } from '../src/games/platformer/level/campaignView';
import { type LevelEntry, LevelManager, memoryStorage, migrateProgress, PROGRESS_VERSION } from '../src/games/platformer/level/LevelManager';
import { type LevelData } from '../src/games/platformer/level/LevelParser';
import { validateLevel } from '../src/games/platformer/level/LevelValidator';
import { buildCatalogs } from '../src/games/platformer/progression/gameData';
import { Profile } from '../src/games/platformer/progression/Profile';

const ROOT = join(__dirname, '..');
const ASSETS = join(ROOT, 'public/assets/platformer');
const readJson = (path: string): any => JSON.parse(readFileSync(join(ASSETS, path), 'utf8'));
const catalogs = buildCatalogs({
  elements: readJson('combat/elements.json'),
  statuses: readJson('combat/status-effects.json'),
  enemies: readJson('enemies/enemies.json'),
  abilities: readJson('abilities/abilities.json'),
});
const BIOME_IDS = Object.keys(BIOMES);

/** Real campaign levels, validated like the game does. */
function realEntries(): LevelEntry[] {
  return (readJson('levels/levels.json').levels as string[]).map((file, index) => {
    const validation = validateLevel(readJson(`levels/${file}`), BIOME_IDS, catalogs.enemies.enemies, BIOME_VARIANTS);
    const data = validation.level as LevelData;
    return { index, file, id: data.id, name: data.name, biome: data.biome, data, validation };
  });
}
const realCampaign = (storage = memoryStorage()) => {
  const entries = realEntries();
  const levels = new LevelManager(entries, storage);
  const { chapters, issues } = buildCampaign(readJson('campaign.json'), { levels: entries, biomes: BIOME_IDS, abilities: catalogs.abilities.abilities });
  return { campaign: new CampaignManager(chapters, levels), levels, chapters, issues, entries };
};

/** Tiny synthetic levels for rule tests. */
const fake = (id: string, biome = 'forest', stars = 3): LevelEntry =>
  ({ index: 0, file: `${id}.json`, id, name: id.toUpperCase(), biome, data: null, validation: { ok: true, issues: [], parsed: { stars: Array(stars).fill({ col: 0, row: 0 }) } } }) as unknown as LevelEntry;
const fakeLevels = (ids: string[]): LevelEntry[] => ids.map((id, index) => ({ ...fake(id), index }));
const chapterJson = (over: Record<string, unknown>) => ({ id: 'c', name: 'C', order: 0, biome: null, levels: ['a'], unlock: null, ...over });
const build = (chapters: unknown[], ids = ['a', 'b', 'c', 'd']) =>
  buildCampaign({ chapters }, { levels: fakeLevels(ids), biomes: BIOME_IDS, abilities: catalogs.abilities.abilities });

describe('campaign.json', () => {
  const { chapters, issues } = realCampaign();

  it('is valid and every level of levels.json belongs to a chapter', () => {
    expect(issues).toEqual([]);
    expect(chapters.map((c) => c.id)).toEqual(['prologue', 'station', 'alien']);
    expect(chapters.map((c) => c.order)).toEqual([0, 1, 2]);
  });

  it('registers the four existing levels as Prólogo with their original ids and order', () => {
    const prologue = chapters[0];
    expect(prologue).toMatchObject({ status: 'ready', unlock: [], biome: null });
    expect(prologue.levels).toEqual(['forest-1', 'ruins-1', 'ice-1', 'volcano-1']);
    const registry = readJson('levels/levels.json').levels as string[];
    expect(registry.map((f) => readJson(`levels/${f}`).id)).toEqual(prologue.levels);
  });

  it('prepares the station and alien chapters as planned, with four levels each and no level references', () => {
    for (const [id, biome] of [['station', 'station'], ['alien', 'alien']]) {
      const chapter = chapters.find((c) => c.id === id)!;
      expect(chapter).toMatchObject({ status: 'planned', plannedLevels: 4, levels: [], biome });
    }
    expect(chapters[1].unlock).toEqual(['prologue']);
    expect(chapters[2].unlock).toEqual(['station']);
  });

  it('planned chapters are never playable', () => {
    const { campaign } = realCampaign();
    for (const id of ['station', 'alien']) {
      expect(campaign.isChapterUnlocked(id)).toBe(false);
      expect(campaign.levelsOf(id)).toEqual([]);
    }
  });

  it('rejects invalid chapters instead of breaking the loader', () => {
    const cases: Array<[string, unknown, RegExp]> = [
      ['missing level', chapterJson({ levels: ['zzz'] }), /no existe/],
      ['no levels', chapterJson({ levels: [] }), /al menos un nivel/],
      ['unknown biome', chapterJson({ biome: 'lava' }), /bioma/],
      ['bad order', chapterJson({ order: -1 }), /order/],
      ['planned with levels', chapterJson({ planned: true, plannedLevels: 4, levels: ['a'] }), /planned/],
      ['planned without count', chapterJson({ planned: true, levels: [] }), /plannedLevels/],
      ['bad unlock', chapterJson({ unlock: { chapters: ['ghost'] } }), /inexistentes/],
      ['bad reward', chapterJson({ rewards: { abilities: [{ id: 'ghost', level: 1 }] } }), /desconocida/],
      ['reward level too high', chapterJson({ rewards: { abilities: [{ id: 'beam', level: 9 }] } }), /nivel 9/],
      ['bad id', chapterJson({ id: 'Bad Id' }), /id/],
    ];
    for (const [label, entry, message] of cases) {
      const result = build([entry]);
      expect(result.chapters[0].status, label).toBe('broken');
      expect(result.issues.map((i) => i.message).join('\n'), label).toMatch(message);
    }
  });

  it('detects level ownership conflicts, biome mismatches, duplicates and cycles', () => {
    const dup = build([chapterJson({ id: 'x', order: 0, levels: ['a', 'b'] }), chapterJson({ id: 'y', order: 1, levels: ['b'] })]);
    expect(dup.issues.map((i) => i.message).join()).toMatch(/ya pertenece/);
    const mismatch = buildCampaign({ chapters: [chapterJson({ biome: 'ice', levels: ['a'] })] }, { levels: fakeLevels(['a']), biomes: BIOME_IDS });
    expect(mismatch.issues[0].message).toMatch(/bioma "forest"/);
    const ids = build([chapterJson({ id: 'x', order: 0 }), chapterJson({ id: 'x', order: 1, levels: ['b'] })]);
    expect(ids.issues.map((i) => i.message).join()).toMatch(/duplicado/);
    const cycle = build([chapterJson({ id: 'x', order: 0, levels: ['a'], unlock: { chapters: ['y'] } }), chapterJson({ id: 'y', order: 1, levels: ['b'], unlock: { chapters: ['x'] } })]);
    expect(cycle.chapters.every((c) => c.status === 'broken')).toBe(true);
    expect(cycle.issues.map((i) => i.message).join()).toMatch(/ciclo/);
  });

  it('reports levels that no chapter owns', () => {
    const result = build([chapterJson({ levels: ['a'] })], ['a', 'orphan']);
    expect(result.issues.map((i) => i.message).join()).toMatch(/orphan/);
  });

  it('survives a missing or malformed file', () => {
    expect(build([]).chapters).toEqual([]);
    expect(buildCampaign(null, { levels: [], biomes: [] }).issues).toHaveLength(1);
    expect(buildCampaign({ chapters: 'x' }, { levels: [], biomes: [] }).chapters).toEqual([]);
  });
});

describe('desbloqueos y progreso (reglas)', () => {
  const setup = (chapters: unknown[], ids: string[]) => {
    const entries = fakeLevels(ids);
    const levels = new LevelManager(entries, memoryStorage());
    const built = buildCampaign({ chapters }, { levels: entries, biomes: BIOME_IDS });
    return { campaign: new CampaignManager(built.chapters, levels), levels, issues: built.issues };
  };
  const two = () =>
    setup(
      [
        chapterJson({ id: 'one', order: 0, levels: ['a', 'b'], rewards: { abilities: [{ id: 'beam', level: 1 }] } }),
        chapterJson({ id: 'two', order: 1, levels: ['c', 'd'], unlock: { chapters: ['one'] } }),
        chapterJson({ id: 'three', order: 2, planned: true, plannedLevels: 4, levels: [], unlock: { chapters: ['two'] } }),
      ],
      ['a', 'b', 'c', 'd'],
    );

  it('starts with only the first level of the first chapter open', () => {
    const { campaign, issues } = two();
    expect(issues).toEqual([]);
    expect(campaign.isLevelUnlocked('a')).toBe(true);
    for (const id of ['b', 'c', 'd']) expect(campaign.isLevelUnlocked(id)).toBe(false);
    expect(campaign.availableChapters().map((c) => c.id)).toEqual(['one']);
  });

  it('completing levels opens the next ones inside the chapter, never across chapters', () => {
    const { campaign } = two();
    const result = campaign.complete('a', { stars: 2, total: 3 });
    expect(result.next?.id).toBe('b');
    expect(result.chapterCompleted).toBe(false);
    expect(campaign.isLevelUnlocked('b')).toBe(true);
    expect(campaign.isLevelUnlocked('c')).toBe(false);
  });

  it('finishing a chapter unlocks the next one, reports it and grants its rewards', () => {
    const { campaign } = two();
    campaign.complete('a', { stars: 1, total: 3 });
    const done = campaign.complete('b', { stars: 3, total: 3 });
    expect(done.next).toBeUndefined();
    expect(done.chapterCompleted).toBe(true);
    expect(done.unlockedChapters.map((c) => c.id)).toEqual(['two']);
    expect(campaign.isLevelUnlocked('c')).toBe(true);
    expect(campaign.earnedRewards()).toEqual([{ ability: 'beam', level: 1 }]);
    expect(campaign.nextChapter('one')?.id).toBe('two');
    expect(campaign.nextChapter('two')).toBeUndefined();
  });

  it('chapter requirements are derived: no completed level, no unlock', () => {
    const { campaign } = two();
    expect(campaign.isChapterUnlocked('two')).toBe(false);
    expect(campaign.isChapterUnlocked('three')).toBe(false);
  });

  it('counts completed levels and best stars, keeping the best run', () => {
    const { campaign } = two();
    campaign.complete('a', { stars: 2, total: 3 });
    campaign.complete('a', { stars: 1, total: 3 });
    expect(campaign.progressOf('one')).toMatchObject({ completed: 1, total: 2, stars: 2, starsTotal: 6, unlocked: true, isCompleted: false, status: 'ready' });
    expect(campaign.progressOf('three')).toMatchObject({ total: 4, completed: 0, status: 'planned', unlocked: false });
  });

  it('positions, ownership and the default level follow the chapters', () => {
    const { campaign } = two();
    expect(campaign.chapterOf('c')?.id).toBe('two');
    expect(campaign.positionOf('d')).toBe(2);
    expect(campaign.latestUnlockedLevel()?.id).toBe('a');
    campaign.complete('a', { stars: 0, total: 3 });
    campaign.complete('b', { stars: 0, total: 3 });
    expect(campaign.latestUnlockedLevel()?.id).toBe('c');
  });

  it('broken chapters are listed but never unlock anything', () => {
    const { campaign, issues } = setup([chapterJson({ id: 'one', levels: ['ghost'] })], ['a']);
    expect(issues.length).toBeGreaterThan(0);
    expect(campaign.isChapterUnlocked('one')).toBe(false);
    expect(campaign.levelsOf('one')).toEqual([]);
  });
});

describe('Prólogo con los niveles reales', () => {
  it('only the forest is open at the start; each level opens the next', () => {
    const { campaign } = realCampaign();
    expect(campaign.availableChapters().map((c) => c.id)).toEqual(['prologue']);
    expect(['forest-1', 'ruins-1', 'ice-1', 'volcano-1'].map((id) => campaign.isLevelUnlocked(id))).toEqual([true, false, false, false]);
    campaign.complete('forest-1', { stars: 10, total: 37 });
    expect(campaign.isLevelUnlocked('ruins-1')).toBe(true);
  });

  it('completing the volcano finishes the chapter; the station stays planned', () => {
    const { campaign } = realCampaign();
    for (const id of ['forest-1', 'ruins-1', 'ice-1']) campaign.complete(id, { stars: 1, total: 10 });
    const last = campaign.complete('volcano-1', { stars: 5, total: 31 });
    expect(last.chapterCompleted).toBe(true);
    expect(last.unlockedChapters).toEqual([]);
    expect(campaign.isChapterCompleted('prologue')).toBe(true);
    expect(campaign.progressOf('prologue')).toMatchObject({ completed: 4, total: 4, stars: 8 });
    expect(campaign.progressOf('prologue').starsTotal).toBe(37 + 19 + 23 + 31);
    expect(campaign.isChapterUnlocked('station')).toBe(false);
  });

  it('the volcano level still has its boss', () => {
    const { entries } = realCampaign();
    const volcano = entries.find((e) => e.id === 'volcano-1')!;
    expect(volcano.validation.parsed?.enemies.some((e) => e.type === 'magma-king')).toBe(true);
  });

  it('the profile requirement of the laser still resolves through levels', () => {
    const { campaign } = realCampaign();
    const profile = new Profile(catalogs.abilities, memoryStorage());
    profile.recordStars('x', Array.from({ length: 100 }, (_, i) => `${i},0`));
    expect(profile.purchase('laser-cannon', (id) => campaign.isLevelCompleted(id))).toMatchObject({ ok: false, reason: 'locked' });
    campaign.complete('ice-1', { stars: 0, total: 1 });
    expect(profile.purchase('laser-cannon', (id) => campaign.isLevelCompleted(id))).toMatchObject({ ok: true });
  });
});

describe('compatibilidad de partidas guardadas', () => {
  const v1 = { unlocked: ['forest-1', 'ruins-1', 'ice-1'], best: { 'forest-1': { stars: 30, total: 37 }, 'ruins-1': { stars: 12, total: 19 } } };

  it('keeps completed levels and best scores of a v1 save and derives the unlocks', () => {
    const storage = memoryStorage();
    storage.save(JSON.stringify(v1));
    const { campaign, levels } = realCampaign(storage);
    expect(levels.best('forest-1')).toEqual({ stars: 30, total: 37 });
    expect(campaign.isLevelCompleted('ruins-1')).toBe(true);
    expect(campaign.isLevelUnlocked('ice-1')).toBe(true);
    expect(campaign.isLevelUnlocked('volcano-1')).toBe(false);
    expect(campaign.progressOf('prologue')).toMatchObject({ completed: 2, stars: 42 });
  });

  it('rewrites the save as v2 without the redundant unlocked list', () => {
    const storage = memoryStorage();
    storage.save(JSON.stringify(v1));
    realCampaign(storage);
    const saved = JSON.parse(storage.load() ?? '{}');
    expect(saved).toEqual({ version: PROGRESS_VERSION, best: v1.best });
  });

  it('a tampered "unlocked" list can no longer open levels that were not earned', () => {
    const storage = memoryStorage();
    storage.save(JSON.stringify({ unlocked: ['volcano-1', 'ice-1'], best: {} }));
    const { campaign } = realCampaign(storage);
    expect(campaign.isLevelUnlocked('volcano-1')).toBe(false);
    expect(campaign.isLevelUnlocked('forest-1')).toBe(true);
  });

  it('migration is idempotent and survives garbage', () => {
    const once = migrateProgress(v1);
    expect(migrateProgress(once)).toEqual(once);
    expect(migrateProgress(null)).toEqual({ version: PROGRESS_VERSION, best: {} });
    expect(migrateProgress({ best: { a: { stars: 'x' }, b: { stars: 2, total: 3 } } }).best).toEqual({ b: { stars: 2, total: 3 } });
    const storage = memoryStorage();
    storage.save('{broken');
    expect(realCampaign(storage).campaign.progressOf('prologue').completed).toBe(0);
  });

  it('a v2 save loads as is and is not rewritten', () => {
    const storage = memoryStorage();
    const v2 = JSON.stringify({ version: 2, best: { 'forest-1': { stars: 1, total: 1 } } });
    storage.save(v2);
    realCampaign(storage);
    expect(storage.load()).toBe(v2);
  });

  it('stars, purchases, passives and F/R weapons persist together with the level progress', () => {
    const levelStorage = memoryStorage();
    const profileStorage = memoryStorage();
    const first = realCampaign(levelStorage);
    first.campaign.complete('forest-1', { stars: 3, total: 37 });
    first.campaign.complete('ruins-1', { stars: 2, total: 19 });
    first.campaign.complete('ice-1', { stars: 1, total: 23 });
    const profile = new Profile(catalogs.abilities, profileStorage);
    profile.recordStars('forest-1', Array.from({ length: 150 }, (_, i) => `${i},0`));
    const done = (id: string): boolean => first.campaign.isLevelCompleted(id);
    for (const id of ['beam', 'beam', 'flamethrower', 'laser-cannon', 'jetpack']) profile.purchase(id, done);
    profile.equipWeapon('laser-cannon', 'primary');
    profile.equipWeapon('flamethrower', 'secondary');

    const again = realCampaign(levelStorage);
    const reloaded = new Profile(catalogs.abilities, profileStorage);
    expect(again.campaign.progressOf('prologue')).toMatchObject({ completed: 3, stars: 6 });
    expect(reloaded.balance).toBe(profile.balance);
    expect(reloaded.earned).toBe(150);
    expect(reloaded.levelOf('beam')).toBe(2);
    expect(reloaded.isEquipped('jetpack')).toBe(true);
    expect(reloaded.equippedOn('primary')).toBe('laser-cannon');
    expect(reloaded.equippedOn('secondary')).toBe('flamethrower');
  });

  it('without the campaign, the LevelManager keeps the previous linear rule', () => {
    const levels = new LevelManager(fakeLevels(['a', 'b', 'c']), memoryStorage());
    expect([levels.isUnlocked('a'), levels.isUnlocked('b')]).toEqual([true, false]);
    expect(levels.complete('a', { stars: 1, total: 1 })?.id).toBe('b');
    expect(levels.isUnlocked('b')).toBe(true);
  });
});

describe('variantes de bioma', () => {
  const lighting = { vignette: 0.5, overlay: { color: 0x112233, alpha: 0.2, blend: 'add' as const } };
  const withVariants = (variants: NonNullable<typeof ICE_DEFINITION.variants>) => createBiome({ ...ICE_DEFINITION, id: 'frost', variants });

  it('the four current biomes keep their ids, texture keys and have no variants', () => {
    expect(Object.keys(BIOMES).sort()).toEqual(['forest', 'ice', 'ruins', 'volcano']);
    for (const biome of Object.values(BIOMES)) {
      expect(biome).toMatchObject({ baseId: biome.id, variant: null, variants: {} });
      expect(biome.tileset).toBe(`platformer.biome.${biome.id}.tiles`);
      expect(biome.assets).toHaveLength(9);
    }
    expect(BIOME_THEMES).toHaveLength(4);
    expect(Object.values(BIOME_VARIANTS).every((v) => v.length === 0)).toBe(true);
    expect(getBiome('ice')).toBe(BIOMES.ice);
  });

  it('a variant inherits everything it does not override', () => {
    const theme = withVariants({ night: { lighting } });
    const night = theme.variants.night;
    const base = theme;
    expect(night).toMatchObject({ id: 'frost/night', baseId: 'frost', variant: 'night', name: base.name, accentColor: base.accentColor });
    expect(night.decorationTypes).toEqual(base.decorationTypes);
    expect(night.ambient).toEqual(base.ambient);
    expect(night.fx).toEqual(base.fx);
    expect(night.lighting).toMatchObject({ vignette: 0.5, overlay: lighting.overlay });
    expect(base.lighting.vignette).not.toBe(0.5);
  });

  it('can override palette, decorations, ambient particles, lighting, name and accent', () => {
    const theme = withVariants({
      deep: {
        name: 'Hielo profundo',
        accentColor: '#112233',
        palette: { surface: '#102030' },
        decorations: [{ type: 'crystals', weight: 3 }],
        ambient: [{ particle: 'pixel', colors: ['#ffffff'], frequency: 50, lifespan: [100, 200], speedX: [0, 1], speedY: [0, 1] }],
        lighting: { vignette: 0.9 },
        dust: ['#000000'],
      },
    });
    const deep = theme.variants.deep;
    expect(deep.name).toBe('Hielo profundo');
    expect(deep.accentColor).toBe(0x112233);
    expect(deep.decorationTypes).toHaveLength(1);
    expect(deep.ambient).toHaveLength(1);
    expect(deep.lighting.vignette).toBe(0.9);
    expect(deep.lighting.overlay).toEqual(theme.lighting.overlay);
    expect(deep.fx.dust).toEqual([0]);
    expect(resolveVariant(ICE_DEFINITION, { palette: { surface: '#102030' } }).palette.surface).toBe('#102030');
    expect(resolveVariant(ICE_DEFINITION, { palette: { surface: '#102030' } }).palette.rock).toBe(ICE_DEFINITION.palette.rock);
  });

  it('does not regenerate textures a variant does not change', () => {
    const theme = withVariants({ night: { lighting, ambient: [], decorations: [{ type: 'tuft', weight: 1 }] } });
    const night = theme.variants.night;
    expect(ownedParts(ICE_DEFINITION, { lighting }).size).toBe(0);
    expect(night.tileset).toBe(theme.tileset);
    expect(night.parallax.map((l) => l.key)).toEqual(theme.parallax.map((l) => l.key));
    expect(night.anims.map((a) => a.key)).toEqual(theme.anims.map((a) => a.key));
    expect(night.assets.map((a) => a.key)).toEqual(theme.assets.map((a) => a.key));
  });

  it('a palette change gives the variant its own textures; style changes spare the mist', () => {
    const palette = createBiome({ ...ICE_DEFINITION, id: 'frost', variants: { red: { palette: { sky: [[0, '#400000'], [1, '#800000']] } } } });
    const red = palette.variants.red;
    expect(ownedParts(ICE_DEFINITION, { palette: { surface: '#102030' } }).size).toBe(9);
    expect(red.tileset).toBe('platformer.biome.frost.red.tiles');
    expect(red.backgroundColor).toBe('#400000');
    expect(red.parallax.every((l) => l.key.startsWith('platformer.biome.frost.red.'))).toBe(true);
    const style = ownedParts(ICE_DEFINITION, { style: { surface: 'ash' } });
    expect(style.has('mist')).toBe(false);
    expect(style.has('tiles')).toBe(true);
  });

  it('PNG files and a different seed give only the affected parts their own key', () => {
    const files = ownedParts(ICE_DEFINITION, { files: { tiles: 'assets/x.png' } });
    expect([...files]).toEqual(['tiles']);
    const theme = withVariants({ custom: { files: { tiles: 'assets/x.png', sky: 'assets/sky.png' } } });
    const custom = theme.variants.custom;
    expect(custom.assets.find((a) => a.key === custom.tileset)).toMatchObject({ url: 'assets/x.png' });
    expect(custom.parallax[0].key).toBe('platformer.biome.frost.custom.sky');
    expect(custom.parallax[1].key).toBe('platformer.biome.frost.mountains');
    expect([...ownedParts(ICE_DEFINITION, { seed: 99 })]).toEqual(['tiles']);
  });

  it('rejects invalid variant ids', () => {
    expect(() => withVariants({ 'Bad Id': {} })).toThrow(/invalid variant/);
  });

  it('levels may pick a variant; unknown ones are rejected by the validator', () => {
    const level = (extra: Record<string, unknown>) => ({
      id: 'v', name: 'V', biome: 'forest', height: 12, ...extra,
      sections: [{ rows: ['.P........', '##########', '##########'] }, { rows: ['.........O', '##########', '##########'] }],
    });
    const errors = (raw: unknown, variants: Record<string, string[]>) =>
      validateLevel(raw, BIOME_IDS, undefined, variants).issues.filter((i) => i.severity === 'error').map((i) => i.message);
    expect(errors(level({}), {})).toEqual([]);
    expect(errors(level({ variant: 'night' }), { forest: ['night'] })).toEqual([]);
    expect(errors(level({ variant: 'night' }), {})[0]).toMatch(/no tiene variantes/);
    expect(errors(level({ variant: 'day' }), { forest: ['night'] })[0]).toMatch(/night/);
    expect(errors(level({ variant: 5 }), { forest: ['night'] })).toHaveLength(1);
  });

  it('getBiome resolves variants and rejects unknown ones', () => {
    expect(() => getBiome('forest', 'night')).toThrow(/Unknown variant/);
    expect(() => getBiome('nope')).toThrow(/Unknown biome/);
  });
});

describe('selección y navegación', () => {
  it('moves through the grid without leaving it', () => {
    expect(moveSelection(0, 'RIGHT', 3, 3)).toBe(1);
    expect(moveSelection(2, 'RIGHT', 3, 3)).toBe(2);
    expect(moveSelection(0, 'LEFT', 3, 3)).toBe(0);
    expect(moveSelection(1, 'DOWN', 8, 4)).toBe(5);
    expect(moveSelection(5, 'UP', 8, 4)).toBe(1);
    expect(moveSelection(6, 'DOWN', 8, 4)).toBe(6);
    expect(moveSelection(0, 'UP', 8, 4)).toBe(0);
    expect(moveSelection(0, 'DOWN', 0, 4)).toBe(0);
  });

  it('lays cards out centered, row by row', () => {
    const pts = gridCenters(3, 3, 96, 108, 8, 160, 98);
    expect(pts.map((p) => p.x)).toEqual([56, 160, 264]);
    expect(new Set(pts.map((p) => p.y))).toEqual(new Set([98]));
    expect(pts[0].x - 48).toBeGreaterThanOrEqual(0);
    expect(pts[2].x + 48).toBeLessThanOrEqual(320);
    const five = gridCenters(5, 4, 68, 84, 8, 160, 100);
    expect(five[4].x).toBe(160);
    expect(five[4].y).toBeGreaterThan(five[0].y);
  });

  it('chapter cards show name, description, biome, progress, stars and state', () => {
    const { campaign } = realCampaign();
    const name = (id: string): string => BIOMES[id]?.name ?? id;
    const [prologue, station, alien] = chapterCards(campaign, name);
    expect(prologue).toMatchObject({ id: 'prologue', name: 'Prologo', biome: 'Varios', levels: '0/4', stars: '0/110', stateLabel: 'Disponible', selectable: true });
    expect(prologue.description).not.toBe('');
    expect(station).toMatchObject({ stateLabel: 'Proximamente', selectable: false, levels: '0/4', status: 'planned', biome: 'station' });
    expect(alien).toMatchObject({ stateLabel: 'Proximamente', selectable: false });
    expect(station.requires).toEqual(['Prologo']);
    for (const id of ['forest-1', 'ruins-1', 'ice-1', 'volcano-1']) campaign.complete(id, { stars: 1, total: 1 });
    const done = chapterCards(campaign, name)[0];
    expect(done).toMatchObject({ stateLabel: 'Completado', levels: '4/4', stars: '4/110', completed: true });
  });

  it('level cards list the chapter levels in order with lock state and stars', () => {
    const { campaign } = realCampaign();
    campaign.complete('forest-1', { stars: 7, total: 37 });
    const cards = levelCards(campaign, 'prologue');
    expect(cards.map((c) => [c.position, c.id, c.unlocked, c.completed])).toEqual([
      [1, 'forest-1', true, true],
      [2, 'ruins-1', true, false],
      [3, 'ice-1', false, false],
      [4, 'volcano-1', false, false],
    ]);
    expect(cards[0]).toMatchObject({ stars: 7, starsTotal: 37, biome: 'forest' });
    expect(levelCards(campaign, 'station')).toEqual([]);
  });

  it('opens the right chapter by default and ignores unusable ones', () => {
    const { campaign } = realCampaign();
    expect(defaultChapterId(campaign)).toBe('prologue');
    expect(defaultChapterId(campaign, 'station')).toBe('prologue');
    expect(defaultChapterId(campaign, 'nope')).toBe('prologue');
    campaign.lastChapterId = 'prologue';
    expect(defaultChapterId(campaign, null)).toBe('prologue');
  });

  it('scenes are registered and wired for keyboard, mouse and touch', () => {
    const read = (p: string): string => readFileSync(join(ROOT, 'src/games/platformer', p), 'utf8');
    const index = read('index.ts');
    expect(index).toMatch(/scenes: \[[^\]]*PlatformerChapterSelectScene[^\]]*PlatformerLevelSelectScene/);
    expect(new Set(Object.values(PlatformerScenes)).size).toBe(Object.values(PlatformerScenes).length);
    expect(PlatformerScenes.ChapterSelect).toBe('Platformer.ChapterSelect');
    expect(read('scenes/PlatformerPreloadScene.ts')).toMatch(/scene\.start\(PlatformerScenes\.ChapterSelect\)/);

    const chapters = read('scenes/PlatformerChapterSelectScene.ts');
    const levels = read('scenes/PlatformerLevelSelectScene.ts');
    for (const scene of [chapters, levels]) {
      for (const key of ['LEFT', 'RIGHT', 'UP', 'DOWN']) expect(scene).toContain(`'${key}'`);
      for (const key of ['keydown-ENTER', 'keydown-SPACE', 'keydown-ESC', 'keydown-T']) expect(scene).toContain(key);
      expect(scene).toContain('pointerup');
      expect(scene).toContain('pointerover');
      expect(scene).toContain('TIENDA');
    }
    expect(chapters).toMatch(/exitToMenu/);
    expect(chapters).toMatch(/PlatformerScenes\.LevelSelect, \{ chapterId/);
    expect(levels).toMatch(/openChapterSelect/);
    expect(levels).toContain('< CAPITULOS');
  });

  it('victory, pause and game over screens return to the chapter lists', () => {
    const hud = readFileSync(join(ROOT, 'src/games/platformer/scenes/PlatformerHudScene.ts'), 'utf8');
    expect(hud).toMatch(/openChapterSelect/);
    expect(hud).toMatch(/Capitulo completado/);
  });
});

describe('capítulos futuros: cómo se incorporan', () => {
  it('a planned chapter becomes playable by listing existing levels and dropping "planned"', () => {
    const ids = ['s1', 's2'];
    const entries = fakeLevels(ids).map((e) => ({ ...e, biome: 'ice' }));
    const planned = buildCampaign({ chapters: [chapterJson({ id: 'p', levels: [], planned: true, plannedLevels: 2, biome: 'ice' })] }, { levels: [], biomes: BIOME_IDS });
    expect(planned.chapters[0].status).toBe('planned');
    const ready = buildCampaign({ chapters: [chapterJson({ id: 'p', levels: ids, biome: 'ice' })] }, { levels: entries, biomes: BIOME_IDS });
    expect(ready.issues).toEqual([]);
    expect(ready.chapters[0]).toMatchObject({ status: 'ready' } satisfies Partial<ChapterDef>);
    const campaign = new CampaignManager(ready.chapters, new LevelManager(entries, memoryStorage()));
    expect(campaign.isLevelUnlocked('s1')).toBe(true);
    expect(campaign.isLevelUnlocked('s2')).toBe(false);
  });

  it('a chapter that points to a level file that does not exist is reported, not fatal', () => {
    const result = build([chapterJson({ id: 'later', levels: ['c1-1-hangar'] })]);
    expect(result.chapters[0].status).toBe('broken');
  });
});
