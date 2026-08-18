import { describe, it, expect } from 'vitest';
import { getVisiblePages, canEditPage } from '../state/reader.js';

function p(over) {
  return { id: 'x', title: 't', body: '', kind: 'lore',
    visibility: 'players', author: '@a:s', created_at: 1, updated_at: 1, last_editor: '@a:s', ...over };
}
function sm(opts = {}) {
  const users = {};
  for (const id of opts.gms || []) users[id] = 50;
  return {
    pages: new Map(Object.entries(opts.pages || {})),
    powerLevels: { users },
    widgetManager: { userId: opts.me || '@me:s' },
  };
}

describe('getVisiblePages', () => {
  it('hides private pages from non-author non-GM users', () => {
    const state = sm({
      me: '@u:s',
      gms: ['@gm:s'],
      pages: {
        a: p({ id: 'a', visibility: 'private', author: '@other:s' }),
        b: p({ id: 'b', visibility: 'players' }),
        c: p({ id: 'c', visibility: 'gm' }),
      },
    });
    const ids = getVisiblePages(state).map((x) => x.id).sort();
    expect(ids).toEqual(['b']);
  });

  it('shows private pages to their author', () => {
    const state = sm({
      me: '@u:s',
      pages: { a: p({ visibility: 'private', author: '@u:s' }) },
    });
    expect(getVisiblePages(state)).toHaveLength(1);
  });

  it('shows gm-visibility pages only to GMs', () => {
    const state = sm({
      me: '@gm:s', gms: ['@gm:s'],
      pages: { a: p({ visibility: 'gm', author: '@other:s' }) },
    });
    expect(getVisiblePages(state)).toHaveLength(1);
  });
});

describe('canEditPage', () => {
  it('lets the author edit', () => {
    const state = sm({ me: '@u:s' });
    expect(canEditPage(state, p({ author: '@u:s' }))).toBe(true);
  });
  it('lets a GM edit any non-private page', () => {
    const state = sm({ me: '@gm:s', gms: ['@gm:s'] });
    expect(canEditPage(state, p({ visibility: 'players', author: '@other:s' }))).toBe(true);
    expect(canEditPage(state, p({ visibility: 'gm', author: '@other:s' }))).toBe(true);
  });
  it("refuses GM edits on another user's private page", () => {
    const state = sm({ me: '@gm:s', gms: ['@gm:s'] });
    expect(canEditPage(state, p({ visibility: 'private', author: '@other:s' }))).toBe(false);
  });
  it('refuses edits by random players', () => {
    const state = sm({ me: '@rando:s' });
    expect(canEditPage(state, p({ author: '@other:s', visibility: 'players' }))).toBe(false);
  });
});
