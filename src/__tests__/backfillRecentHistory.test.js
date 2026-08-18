/**
 * backfillRecentHistory - surface real chat/scene history past the Yjs flood.
 *
 * The room timeline is dominated by com.matrixvtt.yjs.update events, so a
 * single scrollback page yields ~zero chat entries. This loop keeps paging
 * (each page still advances the timeline) until enough real entries surface,
 * the room start is reached, or the page budget is hit - so a content-rich
 * room's chat/scenes/logs actually appear.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { backfillRecentHistory } from '../ui/log-panel.js';
import { syncProgressSignal } from '../state/ui-signals.js';

const chatEvent = (id) => ({
  type: 'm.room.message',
  event_id: id,
  sender: '@p:hs',
  origin_server_ts: 1,
  content: { msgtype: 'm.text', body: `msg ${id}` },
});
// Yjs traffic is a non-message timeline type - filtered out of the activity log.
const yjsEvent = (id) => ({ type: 'com.matrixvtt.yjs.update', event_id: id, content: {} });

/**
 * Build a fake api whose getMessages() returns the given pages in order.
 * Mirrors MatrixApiAdapter.getMessages: returns { chunk }, and flips
 * hasMoreHistory=false once pages run out (room start).
 */
function makeApi(pages) {
  let i = 0;
  return {
    hasMoreHistory: true,
    getMessages: vi.fn(async function () {
      if (i >= pages.length) { this.hasMoreHistory = false; return { chunk: [] }; }
      const chunk = pages[i++];
      if (i >= pages.length) this.hasMoreHistory = false;
      return { chunk };
    }),
  };
}

function makeUi(api) {
  return /** @type {any} */ ({
    activityLog: [],
    _seenLogEventIds: new Set(),
    widgetManager: { getApi: () => api },
  });
}

beforeEach(() => { vi.restoreAllMocks(); });

describe('backfillRecentHistory', () => {
  it('keeps paging past all-Yjs pages until minEntries real entries accrue', async () => {
    // 3 Yjs-only pages, then a page with 5 chat messages.
    const api = makeApi([
      [yjsEvent('y1'), yjsEvent('y2')],
      [yjsEvent('y3'), yjsEvent('y4')],
      [yjsEvent('y5')],
      [chatEvent('c1'), chatEvent('c2'), chatEvent('c3'), chatEvent('c4'), chatEvent('c5')],
    ]);
    const ui = makeUi(api);

    await backfillRecentHistory(ui, { minEntries: 5, maxPages: 12 });

    expect(ui.activityLog).toHaveLength(5);
    expect(api.getMessages).toHaveBeenCalledTimes(4); // paged past the 3 Yjs pages
  });

  it('stops once minEntries is reached without over-fetching', async () => {
    const api = makeApi([
      [chatEvent('c1'), chatEvent('c2'), chatEvent('c3')],
      [chatEvent('c4'), chatEvent('c5')],
      [chatEvent('c6')], // should not be fetched - budget met after 2 pages
    ]);
    const ui = makeUi(api);

    await backfillRecentHistory(ui, { minEntries: 5, maxPages: 12 });

    expect(ui.activityLog.length).toBeGreaterThanOrEqual(5);
    expect(api.getMessages).toHaveBeenCalledTimes(2);
  });

  it('respects the maxPages budget on a pathologically Yjs-heavy room', async () => {
    const yjsPages = Array.from({ length: 20 }, (_, n) => [yjsEvent(`y${n}`)]);
    const api = makeApi(yjsPages);
    const ui = makeUi(api);

    await backfillRecentHistory(ui, { minEntries: 25, maxPages: 6 });

    expect(api.getMessages).toHaveBeenCalledTimes(6); // capped
    // The exhausted budget leaves a visible notice instead of a
    // silently truncated history.
    expect(ui.activityLog).toHaveLength(1);
    expect(ui.activityLog[0].text).toMatch(/older messages/i);
  });

  it('stops cleanly at room start (hasMoreHistory=false) with fewer than minEntries', async () => {
    const api = makeApi([[chatEvent('c1'), chatEvent('c2')]]); // one short page, then exhausted
    const ui = makeUi(api);

    await backfillRecentHistory(ui, { minEntries: 25, maxPages: 12 });

    expect(ui.activityLog).toHaveLength(2);
    expect(api.hasMoreHistory).toBe(false);
    // One real page + at most the exhausted-probe page; never the full budget.
    expect(api.getMessages.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('no-ops when the api cannot fetch messages', async () => {
    const ui = makeUi({ hasMoreHistory: true }); // no getMessages
    await expect(backfillRecentHistory(ui)).resolves.toBeUndefined();
    expect(ui.activityLog).toHaveLength(0);
  });

  it('reports page-based progress so Yjs-heavy rooms show real movement', async () => {
    // Entries barely accrue (one chat event in page 3) - the bar must
    // advance by PAGES, not by the stalled entry count.
    const api = makeApi([
      [yjsEvent('y1')], [yjsEvent('y2')], [chatEvent('c1')], [yjsEvent('y3')],
    ]);
    const seen = [];
    const inner = api.getMessages;
    api.getMessages = vi.fn(async function (...args) {
      seen.push({ ...syncProgressSignal.value });
      return inner.apply(this, args);
    });
    const ui = makeUi(api);

    await backfillRecentHistory(ui, { minEntries: 25, maxPages: 4 });

    expect(seen[0].label).toBe('Loading history - page 1 of 4…');
    expect(seen[0]).toMatchObject({ done: 0, total: 4 });
    expect(seen[3].label).toBe('Loading history - page 4 of 4…');
    expect(seen[3]).toMatchObject({ done: 3, total: 4 });
    expect(syncProgressSignal.value.active).toBe(false); // cleared after
  });
});
