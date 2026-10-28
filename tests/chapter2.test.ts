import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Geom: { Rectangle: class {} }, Input: { Keyboard: { KeyCodes: {} } } } }));

import { queueLevels, releaseLevels } from '../src/games/platformer/level/levelLoader';
import { BIOME_THEMES, BIOME_VARIANTS, BIOMES, getBiome } from '../src/games/platformer/biomes';
import { ALIEN_DEFINITION } from '../src/games/platformer/biomes/definitions/alien';
import { resolveVariant } from '../src/games/platformer/biomes/createBiome';
import { DECO, DECO_FRAME_COUNT } from '../src/games/platformer/biomes/biomeArt';
import { buildCatalogs } from '../src/games/platformer/progression/gameData';
import { buildCampaign, CampaignManager } from '../src/games/platformer/level/CampaignManager';
import { LevelManager, memoryStorage, type LevelEntry } from '../src/games/platformer/level/LevelManager';
import { validateLevel } from '../src/games/platformer/level/LevelValidator';
import { PLATFORMER_ACCESS } from '../src/games/platformer/progression/accessPolicy';
import { chapterCards } from '../src/games/platformer/level/campaignView';

const readJson = (file: string): unknown => JSON.parse(readFileSync(join(__dirname, '../public/assets/platformer', file), 'utf8'));
const registry = readJson('levels/levels.json') as { levels: string[]; plannedLevels: string[] };
const catalogs = buildCatalogs({ elements: readJson('combat/elements.json'), statuses: readJson('combat/status-effects.json'), enemies: readJson('enemies/enemies.json'), abilities: readJson('abilities/abilities.json') });
const validate = (raw: unknown) => validateLevel(raw, Object.keys(BIOMES), catalogs.enemies.enemies, BIOME_VARIANTS);

describe('chapter 2: planned level registry', () => {
  it('queues and releases draft data separately from the playable list', () => {
    const registry = { levels: ['published.json'], plannedLevels: ['chapter2/01-landing.json'] };
    const queued: string[] = [];
    let loaded = (_key: string, _type: string, _registry: typeof registry): void => undefined;
    const scene = { load: {
      json: (_key: string, url: string) => queued.push(url),
      once: (_event: string, callback: typeof loaded) => { loaded = callback; },
    } };
    queueLevels(scene as unknown as Parameters<typeof queueLevels>[0]);
    loaded('platformer.levels.registry', 'json', registry);
    expect(queued).toContain('assets/platformer/levels/published.json');
    expect(queued).toContain('assets/platformer/levels/chapter2/01-landing.json');
    expect(registry.levels).toEqual(['published.json']);
    const remove = vi.fn();
    releaseLevels({ cache: { json: { get: () => registry, remove } } } as unknown as Parameters<typeof releaseLevels>[0]);
    expect(remove).toHaveBeenCalledWith('platformer.level.published.json');
    expect(remove).toHaveBeenCalledWith('platformer.level.chapter2/01-landing.json');
  });
});

describe('alien biome', () => {
  it('loads four variants through the existing registry and texture factory', () => {
    expect(BIOME_VARIANTS.alien).toEqual(['jungle', 'caves', 'lab', 'nest']);
    for (const variant of BIOME_VARIANTS.alien) {
      const theme = getBiome('alien', variant);
      expect(theme).toMatchObject({ id: `alien/${variant}`, baseId: 'alien', variant });
      expect(theme.assets).toHaveLength(9);
      expect(theme.parallax).toHaveLength(8);
      expect(theme.assets.every((asset) => 'drawPlaceholder' in asset && typeof asset.drawPlaceholder === 'function')).toBe(true);
    }
    expect(new Set(BIOME_THEMES.map((theme) => theme.id)).size).toBe(BIOME_THEMES.length);
    expect(BIOMES.station.tileset).toBe('platformer.biome.station.tiles');
    expect(BIOMES.forest.tileset).toBe('platformer.biome.forest.tiles');
  });

  it('adds organic shapes without replacing old decoration frames', () => {
    expect(ALIEN_DEFINITION.style).toMatchObject({ far: 'sporeGroves', near: 'tendrils', blocks: 'organic' });
    expect(DECO.bush).toBe(15);
    expect(DECO.emergency).toBe(16);
    expect(DECO.wallPanel).toBe(21);
    expect(DECO.membrane).toBe(22);
    expect(DECO.organicRib).toBe(23);
    expect(DECO_FRAME_COUNT).toBe(24);
    expect(getBiome('alien', 'nest').decorationTypes.map((deco) => deco.frame)).toContain(DECO.membrane);
    expect(getBiome('alien', 'jungle').tileset).toBe(BIOMES.alien.tileset);
    expect(new Set(BIOME_VARIANTS.alien.map((variant) => getBiome('alien', variant).tileset)).size).toBe(4);
  });

  it.each(['jungle', 'caves', 'lab', 'nest'])('%s keeps bright ledges and combat colors distinct from the background', (variant) => {
    const definition = resolveVariant(ALIEN_DEFINITION, ALIEN_DEFINITION.variants![variant]);
    const luminance = (color: string): number => {
      const channels = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    for (const background of [definition.palette.sky.at(-1)![1], definition.palette.treesFarLight, definition.palette.treesNearLight]) {
      for (const foreground of [definition.palette.surfaceLight, definition.palette.rockLight, '#ff5a7a', '#7ac8ff', '#ffd56b']) {
        const values = [luminance(background), luminance(foreground)].sort((first, second) => first - second);
        expect((values[1] + 0.05) / (values[0] + 0.05)).toBeGreaterThanOrEqual(3);
      }
    }
    expect(definition.lighting.vignette).toBeLessThanOrEqual(0.25);
    expect(definition.lighting.overlay).toBeUndefined();
    expect(definition.decorationDensity!.top).toBeLessThanOrEqual(0.3);
    expect(definition.ambient).toHaveLength(1);
    expect(definition.ambient[0].lifespan[1] / definition.ambient[0].frequency).toBeLessThanOrEqual(12);
  });
});

describe('chapter 2: episode skeletons and campaign references', () => {
  const expected = [
    ['c2-1-landing', 'jungle'], ['c2-2-caves', 'caves'], ['c2-3-lab', 'lab'], ['c2-4-queen', 'nest'],
  ];
  const episodeFiles = ['chapter2/01-landing.json', 'chapter2/02-caves.json', 'chapter2/03-lab.json', 'chapter2/04-queen.json'];
  const episodes = episodeFiles.map((file) => validate(readJson(`levels/${file}`)));

  it('registers four playable chapter levels with stable ids, variants and encounters', () => {
    expect(episodes).toHaveLength(4);
    expect(episodes.map((result) => [result.level?.id, result.level?.variant])).toEqual(expected);
    expect(catalogs.issues).toEqual([]);
    for (const result of episodes) {
      expect(result.issues, result.level?.id).toEqual([]);
      expect(result.ok, result.level?.id).toBe(true);
      expect(result.parsed?.biome).toBe('alien');
      expect(result.parsed?.enemies.length).toBeGreaterThan(0);
      expect(result.level?.sections.length).toBeGreaterThanOrEqual(6);
    }
    expect(episodes[3].level?.bossEncounter).toMatchObject({ enemy: 'swarm-queen' });
  });

  it('allows existing hazards to use a bio-technician signal only when that enemy is placed', () => {
    const level = {
      id: 'c2-test-signals',
      name: 'Test signals',
      biome: 'alien',
      variant: 'jungle',
      height: 12,
      sections: [{ rows: [...Array.from({ length: 9 }, () => '....................'), '...P..B............O', '####################', '####################'] }],
      enemies: { B: 'bio-technician' },
      story: { beats: [] },
      objects: [{ type: 'laser', col: 14, row: 5, orientation: 'vertical', length: 2, damage: 1, mode: 'permanent', enabledBy: 'bio-hive' }],
    };
    expect(validate(level).issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    const withoutTechnician = { ...level, enemies: { B: 'walker' } };
    expect(validate(withoutTechnician).issues.some((issue) => issue.message.includes('"bio-hive"'))).toBe(true);
  });

  it('requires every swarm queen vulnerability signal to have an organic node', () => {
    const level = readJson('levels/chapter2/04-queen.json') as { objects: Array<{ type: string; id?: string }> };
    const withoutRightNode = { ...level, objects: level.objects.filter((object) => object.id !== 'queen-right-node') };
    expect(validate(withoutRightNode).issues.some((issue) => issue.message.includes('queen-right-node'))).toBe(true);
    expect(validate(level).issues).toEqual([]);
  });

  it('publishes episodes 2.1–2.4, keeps the configured free access and completes the chapter roster', () => {
    const entries: LevelEntry[] = registry.levels.map((file, index) => {
      const validation = validate(readJson(`levels/${file}`));
      const data = validation.level!;
      return { index, file, id: data.id, name: data.name, biome: data.biome, data, validation };
    });
    const built = buildCampaign(readJson('campaign.json'), { levels: entries, biomes: Object.keys(BIOMES), variants: BIOME_VARIANTS, abilities: catalogs.abilities.abilities, enemies: catalogs.enemies.enemies });
    expect(built.issues).toEqual([]);
    const levels = new LevelManager(entries, memoryStorage());
    const campaign = new CampaignManager(built.chapters, levels, built.meta, PLATFORMER_ACCESS);
    const chapter = campaign.chapter('alien')!;
    expect(chapter).toMatchObject({ name: 'El planeta de las sombras', status: 'ready', plannedLevels: 0, levels: expected.map(([id]) => id) });
    expect(chapter.episodes.map((episode) => [episode.id, episode.variant])).toEqual(expected);
    expect(chapter.episodes.map((episode) => episode.title)).toEqual(episodes.map((result) => result.level?.name));
    expect(chapter.episodes[3].boss).toBe('swarm-queen');
    expect(chapterCards(campaign, (id) => BIOMES[id].name).find((card) => card.id === 'alien')).toMatchObject({ selectable: true, stateLabel: 'Disponible', levels: '0/4' });
    expect(campaign.episodesOf('alien').every((episode) => episode.playable && !!episode.level)).toBe(true);
    for (const [id] of expected) {
      expect(levels.isUnlocked(id)).toBe(true);
      expect(() => levels.getData(id)).not.toThrow();
    }
    expect(entries).toHaveLength(12);
    expect(registry.plannedLevels).toEqual([]);
  });
});