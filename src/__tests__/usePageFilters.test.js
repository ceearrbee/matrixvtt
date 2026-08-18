import { describe, it, expect } from 'vitest';
import { applyPageFilters } from '../ui/usePageFilters.js';

const ps = [
  { id: '1', kind: 'journal',  title: 'Session 1', body: 'Met Alice',  updated_at: 30, visibility: 'players', author: '@alice:hs' },
  { id: '2', kind: 'lore',     title: 'Blackmoor', body: 'A city',     updated_at: 20, visibility: 'gm',      author: '@gm:hs' },
  { id: '3', kind: 'fiction',  title: "Alice's letter", body: '...',   updated_at: 10, visibility: 'private', author: '@alice:hs' },
];

describe('applyPageFilters', () => {
  it('returns all when no filters applied', () => {
    expect(applyPageFilters(ps, { kind: 'all', sort: 'recent', search: '' })).toHaveLength(3);
  });
  it('filters by kind', () => {
    expect(applyPageFilters(ps, { kind: 'lore' }).map((p) => p.id)).toEqual(['2']);
  });
  it('searches title and body case-insensitively', () => {
    expect(applyPageFilters(ps, { search: 'alice' }).map((p) => p.id).sort())
      .toEqual(['1', '3']);
  });
  it('sorts by recent (descending updated_at)', () => {
    expect(applyPageFilters(ps, { sort: 'recent' }).map((p) => p.id)).toEqual(['1', '2', '3']);
  });
  it('sorts by title ascending', () => {
    expect(applyPageFilters(ps, { sort: 'title' }).map((p) => p.id)).toEqual(['3', '2', '1']);
  });

  describe('visibility filter', () => {
    it('all returns everything', () => {
      expect(applyPageFilters(ps, { visibility: 'all' })).toHaveLength(3);
    });
    it('players returns only players-visible pages', () => {
      const out = applyPageFilters(ps, { visibility: 'players' });
      expect(out.map((p) => p.id)).toEqual(['1']);
    });
    it('gm returns only gm-visible pages', () => {
      const out = applyPageFilters(ps, { visibility: 'gm' });
      expect(out.map((p) => p.id)).toEqual(['2']);
    });
    it('mine returns only pages authored by me', () => {
      const out = applyPageFilters(ps, { visibility: 'mine', me: '@alice:hs' });
      expect(out.map((p) => p.id).sort()).toEqual(['1', '3']);
    });
    it('mine with null me returns nothing', () => {
      expect(applyPageFilters(ps, { visibility: 'mine', me: null })).toHaveLength(0);
    });
    it('private returns only private pages authored by me', () => {
      const out = applyPageFilters(ps, { visibility: 'private', me: '@alice:hs' });
      expect(out.map((p) => p.id)).toEqual(['3']);
    });
    it('private does not return other authors private pages', () => {
      const out = applyPageFilters(ps, { visibility: 'private', me: '@gm:hs' });
      expect(out).toHaveLength(0);
    });
  });
});
