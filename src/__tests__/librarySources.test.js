import { describe, it, expect, vi } from 'vitest';
import {
  createBundledSource,
  createPersonalSource,
  getLibrarySources,
  filterEntries,
} from '../library/sources.js';
import { LIBRARY_KIND } from '../utils/constants.js';

const BUNDLE = [
  { id: 'c-1', kind: LIBRARY_KIND.NPC, name: 'Town Guard', data: {} },
  { id: 'c-2', kind: LIBRARY_KIND.ITEM, name: 'Torch', data: {} },
];

describe('createBundledSource', () => {
  it('is read-only and filters by kind', async () => {
    const src = createBundledSource('community', 'Community', async () => BUNDLE);
    expect(src.writable).toBe(false);
    const npcs = await src.listEntries(LIBRARY_KIND.NPC);
    expect(npcs.map((e) => e.name)).toEqual(['Town Guard']);
    expect(await src.getEntry('c-2')).toMatchObject({ name: 'Torch' });
  });

  it('returns all entries when no kind is given', async () => {
    const src = createBundledSource('community', 'Community', async () => BUNDLE);
    expect(await src.listEntries()).toHaveLength(2);
  });
});

describe('createPersonalSource', () => {
  it('is writable and delegates to the manager', async () => {
    const mgr = {
      listEntries: vi.fn(async () => [BUNDLE[0]]),
      saveEntry: vi.fn(async () => 'lib-9'),
      deleteEntry: vi.fn(async () => {}),
      renameEntry: vi.fn(async () => {}),
    };
    const src = createPersonalSource(mgr);
    expect(src.writable).toBe(true);
    await src.listEntries(LIBRARY_KIND.NPC);
    expect(mgr.listEntries).toHaveBeenCalledWith(LIBRARY_KIND.NPC);
    await src.saveEntry({ kind: 'item', name: 'X', data: {} });
    expect(mgr.saveEntry).toHaveBeenCalled();
    await src.deleteEntry('lib-1');
    expect(mgr.deleteEntry).toHaveBeenCalledWith('lib-1');
    await src.renameEntry('lib-1', 'Y');
    expect(mgr.renameEntry).toHaveBeenCalledWith('lib-1', 'Y');
  });
});

describe('getLibrarySources', () => {
  it('lists the personal source first, then community', () => {
    const sources = getLibrarySources({ listEntries: async () => [] });
    expect(sources.map((s) => s.id)).toEqual(['personal', 'community']);
    expect(sources[0].writable).toBe(true);
    expect(sources[1].writable).toBe(false);
  });
});

describe('filterEntries', () => {
  it('matches by case-insensitive name substring', () => {
    expect(filterEntries(BUNDLE, 'torch').map((e) => e.name)).toEqual(['Torch']);
    expect(filterEntries(BUNDLE, '')).toHaveLength(2);
  });
});
