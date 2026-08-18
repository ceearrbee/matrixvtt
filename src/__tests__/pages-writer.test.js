import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../state/StateManager.js';
import { updatePage, deletePage, setPageThreadRoot } from '../state/writers/entity-writers.js';

function makeSM() {
  const widgetManager = { roomId: '!r:s', userId: '@u:s', init: async () => {}, getApi: () => null };
  return new StateManager(widgetManager, {});
}

describe('pages writers', () => {
  let sm;
  beforeEach(() => { sm = makeSM(); });

  it('updatePage writes to yjs.pagesMap', async () => {
    await updatePage(sm, 'p1', { id: 'p1', title: 'Hi', body: '', kind: 'lore',
      visibility: 'players', author: '@u:s', created_at: 1, updated_at: 1, last_editor: '@u:s' });
    expect(sm.yjs.pagesMap.get('p1')).toMatchObject({ id: 'p1', title: 'Hi' });
  });

  it('deletePage removes from yjs.pagesMap', async () => {
    await updatePage(sm, 'p1', { id: 'p1', title: 'Hi' });
    await deletePage(sm, 'p1');
    expect(sm.yjs.pagesMap.has('p1')).toBe(false);
  });

  it('setPageThreadRoot writes thread_root_event_id once and is idempotent on equal values', async () => {
    const page = { id: 'p1', title: 'X', thread_root_event_id: null };
    await updatePage(sm, 'p1', page);
    await setPageThreadRoot(sm, 'p1', '$ev:s');
    expect(sm.yjs.pagesMap.get('p1').thread_root_event_id).toBe('$ev:s');
    await setPageThreadRoot(sm, 'p1', '$ev:s');
    expect(sm.yjs.pagesMap.get('p1').thread_root_event_id).toBe('$ev:s');
  });

  it('setPageThreadRoot refuses to overwrite an existing different root', async () => {
    await updatePage(sm, 'p1', { id: 'p1', thread_root_event_id: '$first:s' });
    await expect(setPageThreadRoot(sm, 'p1', '$second:s')).rejects.toThrow(/thread root/i);
    expect(sm.yjs.pagesMap.get('p1').thread_root_event_id).toBe('$first:s');
  });
});
