/**
 * Generic search index over compendium collections: precomputed name
 * lookups and facet buckets so the browser doesn't rescan every entry
 * per keystroke.
 */
import { describe, it, expect } from 'vitest';
import { buildSearchIndex } from '../content/compendium/search-index.js';

const MONSTERS = [
  { id: 'srd-npc-goblin', name: 'Goblin', cr: '1/4', creature_type: 'Humanoid' },
  { id: 'srd-npc-goblin-boss', name: 'Goblin Boss', cr: '1', creature_type: 'Humanoid' },
  { id: 'srd-npc-owlbear', name: 'Owlbear', cr: '3', creature_type: 'Monstrosity' },
];

describe('buildSearchIndex', () => {
  it('finds entries by case-insensitive substring', () => {
    const index = buildSearchIndex(MONSTERS);
    expect(index.searchByName('goblin').map((e) => e.name)).toEqual(['Goblin', 'Goblin Boss']);
    expect(index.searchByName('OWL').map((e) => e.name)).toEqual(['Owlbear']);
  });

  it('returns every entry for an empty or whitespace query', () => {
    const index = buildSearchIndex(MONSTERS);
    expect(index.searchByName('')).toEqual(MONSTERS);
    expect(index.searchByName('   ')).toEqual(MONSTERS);
  });

  it('returns an empty list when nothing matches', () => {
    const index = buildSearchIndex(MONSTERS);
    expect(index.searchByName('dragon')).toEqual([]);
  });

  it('memoizes repeated queries against the same cache entry', () => {
    const index = buildSearchIndex(MONSTERS);
    const first = index.searchByName('goblin');
    const second = index.searchByName('Goblin');
    expect(second).toBe(first);
  });

  it('filters by a precomputed facet bucket', () => {
    const index = buildSearchIndex(MONSTERS, { facetKey: (m) => m.cr });
    expect(index.byFacet('1/4').map((e) => e.name)).toEqual(['Goblin']);
    expect(index.byFacet('9')).toEqual([]);
  });

  it('byFacet returns every entry when no value is given', () => {
    const index = buildSearchIndex(MONSTERS, { facetKey: (m) => m.cr });
    expect(index.byFacet('')).toEqual(MONSTERS);
    expect(index.byFacet(undefined)).toEqual(MONSTERS);
  });

  it('query combines a name search with a facet filter', () => {
    const index = buildSearchIndex(MONSTERS, { facetKey: (m) => m.creature_type });
    expect(index.query('goblin', 'Humanoid').map((e) => e.name)).toEqual(['Goblin', 'Goblin Boss']);
    expect(index.query('goblin', 'Monstrosity')).toEqual([]);
    expect(index.query('', '')).toEqual(MONSTERS);
  });

  it('rebuilds from scratch when the underlying data changes', () => {
    const first = buildSearchIndex(MONSTERS, { facetKey: (m) => m.cr });
    const updated = [...MONSTERS, { id: 'srd-npc-dragon', name: 'Dragon', cr: '17', creature_type: 'Dragon' }];
    const second = buildSearchIndex(updated, { facetKey: (m) => m.cr });
    expect(first.searchByName('dragon')).toEqual([]);
    expect(second.searchByName('dragon').map((e) => e.name)).toEqual(['Dragon']);
    expect(second.byFacet('17').map((e) => e.name)).toEqual(['Dragon']);
  });
});
