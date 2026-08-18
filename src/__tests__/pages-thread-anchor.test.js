import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../state/StateManager.js';
import { updatePage } from '../state/writers/entity-writers.js';
import { ensurePageThreadRoot } from '../utils/page-comments.js';

function makeSM() {
  const sent = [];
  const widgetManager = {
    roomId: '!r:s', userId: '@u:s',
    init: async () => {}, getApi: () => null,
    sendRoomEvent: async (type, content) => {
      const event_id = '$ev_' + sent.length;
      sent.push({ type, content, event_id });
      return { event_id };
    },
  };
  const sm = new StateManager(widgetManager, {});
  return { sm, sent };
}

describe('ensurePageThreadRoot (lazy synthetic anchor)', () => {
  let sm, sent;
  beforeEach(() => { ({ sm, sent } = makeSM()); });

  it('creates and stores a thread root on first call', async () => {
    await updatePage(sm, 'p1', { id: 'p1', title: 'Doc', thread_root_event_id: null });
    const id = await ensurePageThreadRoot(sm, 'p1');
    expect(id).toMatch(/^\$ev_0$/);
    expect(sm.yjs.pagesMap.get('p1').thread_root_event_id).toBe(id);
    expect(sent).toHaveLength(1);
    expect(sent[0].content.body).toContain('Comments on: Doc');
  });

  it('returns the existing root on subsequent calls without resending', async () => {
    await updatePage(sm, 'p1', { id: 'p1', title: 'Doc', thread_root_event_id: '$existing:s' });
    const id = await ensurePageThreadRoot(sm, 'p1');
    expect(id).toBe('$existing:s');
    expect(sent).toHaveLength(0);
  });
});
