import { describe, it, expect } from 'vitest';
import { builtinIconUrl, searchIcons, isBuiltinIconUrl } from '../utils/builtin-icons.js';

const FIXTURE = {
  version: 1,
  themes: ['dark', 'light'],
  authors: ['lorc', 'delapouite'],
  categories: [
    { key: 'weapons', label: 'Weapons', count: 2 },
    { key: 'items', label: 'Items', count: 1 },
  ],
  icons: [
    { id: 'lorc/handcuffs', name: 'Handcuffs', author: 'lorc', tags: ['handcuffs', 'lorc', 'restraint'], categories: ['items'] },
    { id: 'lorc/broadsword', name: 'Broadsword', author: 'lorc', tags: ['broadsword', 'lorc', 'sword'], categories: ['weapons'] },
    { id: 'delapouite/scimitar', name: 'Scimitar', author: 'delapouite', tags: ['scimitar', 'delapouite', 'sword'], categories: ['weapons'] },
  ],
};

describe('builtinIconUrl', () => {
  it('resolves dark theme to /icons/dark/<id>.svg under the configured base', () => {
    const url = builtinIconUrl('lorc/handcuffs', 'dark', '/matrixvtt/');
    expect(url).toBe('/matrixvtt/icons/dark/lorc/handcuffs.svg');
  });

  it('resolves light theme to /icons/light/<id>.svg', () => {
    const url = builtinIconUrl('delapouite/scimitar', 'light', '/matrixvtt/');
    expect(url).toBe('/matrixvtt/icons/light/delapouite/scimitar.svg');
  });

  it('defaults to dark theme when none supplied', () => {
    const url = builtinIconUrl('lorc/broadsword', undefined, '/matrixvtt/');
    expect(url).toMatch(/\/icons\/dark\//);
  });

  it('normalises base path with or without trailing slash', () => {
    expect(builtinIconUrl('lorc/x', 'dark', '/')).toBe('/icons/dark/lorc/x.svg');
    expect(builtinIconUrl('lorc/x', 'dark', '/foo')).toBe('/foo/icons/dark/lorc/x.svg');
    expect(builtinIconUrl('lorc/x', 'dark', '/foo/')).toBe('/foo/icons/dark/lorc/x.svg');
  });
});

describe('isBuiltinIconUrl', () => {
  it('recognises both themes', () => {
    expect(isBuiltinIconUrl('/matrixvtt/icons/dark/lorc/handcuffs.svg')).toBe(true);
    expect(isBuiltinIconUrl('/icons/light/lorc/handcuffs.svg')).toBe(true);
  });

  it('rejects external URLs and uploads', () => {
    expect(isBuiltinIconUrl('https://example.com/icons/dark/x.svg')).toBe(false);
    expect(isBuiltinIconUrl('mxc://server/abc')).toBe(false);
    expect(isBuiltinIconUrl('')).toBe(false);
    expect(isBuiltinIconUrl(null)).toBe(false);
  });
});

describe('searchIcons', () => {
  it('returns all icons when query is empty', () => {
    const r = searchIcons(FIXTURE, '');
    expect(r).toHaveLength(3);
  });

  it('matches by name (case-insensitive)', () => {
    const r = searchIcons(FIXTURE, 'broad');
    expect(r.map((i) => i.id)).toEqual(['lorc/broadsword']);
  });

  it('matches by tag', () => {
    const r = searchIcons(FIXTURE, 'sword');
    expect(r.map((i) => i.id).sort()).toEqual(['delapouite/scimitar', 'lorc/broadsword']);
  });

  it('filters by category', () => {
    const r = searchIcons(FIXTURE, '', { category: 'weapons' });
    expect(r).toHaveLength(2);
    expect(r.every((i) => i.categories.includes('weapons'))).toBe(true);
  });

  it('filters by author', () => {
    const r = searchIcons(FIXTURE, '', { author: 'delapouite' });
    expect(r).toEqual([FIXTURE.icons[2]]);
  });

  it('AND-composes query + category', () => {
    const r = searchIcons(FIXTURE, 'sword', { category: 'weapons' });
    expect(r).toHaveLength(2);
    const r2 = searchIcons(FIXTURE, 'sword', { category: 'items' });
    expect(r2).toHaveLength(0);
  });

  it('respects the limit option', () => {
    const r = searchIcons(FIXTURE, '', { limit: 1 });
    expect(r).toHaveLength(1);
  });

  it('ranks exact name matches above tag-only matches', () => {
    const fx = {
      ...FIXTURE,
      icons: [
        { id: 'a/sword-plus', name: 'Sword plus', author: 'a', tags: ['sword-plus', 'a'], categories: [] },
        { id: 'a/sword', name: 'Sword', author: 'a', tags: ['sword', 'a'], categories: [] },
        { id: 'a/handcuffs', name: 'Handcuffs', author: 'a', tags: ['handcuffs', 'a', 'sword'], categories: [] },
      ],
    };
    const r = searchIcons(fx, 'sword');
    expect(r[0].id).toBe('a/sword');
  });
});
