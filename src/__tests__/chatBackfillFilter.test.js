/**
 * Server-side-filtered chat backfill.
 *
 * The room timeline is flooded with com.matrixvtt.yjs.update events, so
 * unfiltered scrollback pages yield ~0 chat entries each (12 pages for 12
 * entries in a real room). getChatMessages asks the homeserver for
 * m.room.message events only, so the activity log fills in one request.
 * Widget mode already fetches filtered (receiveRoomEvents); the standalone
 * adapter now has parity, and backfillRecentHistory prefers the filtered
 * path when the api provides it.
 */
import { describe, it, expect, vi } from 'vitest';
import { MatrixApiAdapter } from '../client/MatrixApiAdapter.js';
import { backfillRecentHistory } from '../ui/log-panel.js';

const chatEvent = (id) => ({
  type: 'm.room.message',
  event_id: id,
  sender: '@p:hs',
  origin_server_ts: 1,
  content: { msgtype: 'm.text', body: `msg ${id}` },
});

function makeSdk(pages) {
  let call = 0;
  return {
    on: () => {}, removeListener: () => {},
    credentials: { userId: '@me:hs' },
    createMessagesRequest: vi.fn(async () => {
      const page = pages[call] ?? { chunk: [], end: null };
      call++;
      return page;
    }),
  };
}

describe('MatrixApiAdapter.getChatMessages', () => {
  it('requests m.room.message only and maps the chunk', async () => {
    const sdk = makeSdk([{ chunk: [chatEvent('c1'), chatEvent('c2')], end: 'tok-1' }]);
    const adapter = new MatrixApiAdapter({ sdk }, '!r:hs');

    const { chunk } = await adapter.getChatMessages(50);

    expect(chunk).toHaveLength(2);
    expect(chunk[0]).toMatchObject({ event_id: 'c1', type: 'm.room.message' });
    const [, , limit, dir, filter] = sdk.createMessagesRequest.mock.calls[0];
    expect(limit).toBe(50);
    expect(dir).toBe('b');
    expect(JSON.stringify(filter.getDefinition?.() ?? filter)).toContain('m.room.message');
  });

  it('threads the pagination token and flips hasMoreChatHistory at the end', async () => {
    const sdk = makeSdk([
      { chunk: [chatEvent('c1')], end: 'tok-1' },
      { chunk: [chatEvent('c2')], end: null }, // room start
    ]);
    const adapter = new MatrixApiAdapter({ sdk }, '!r:hs');

    await adapter.getChatMessages(50);
    expect(adapter.hasMoreChatHistory).toBe(true);

    await adapter.getChatMessages(50);
    expect(sdk.createMessagesRequest.mock.calls[1][1]).toBe('tok-1'); // continues from end token
    expect(adapter.hasMoreChatHistory).toBe(false);
  });
});

describe('backfillRecentHistory - filtered path', () => {
  it('prefers getChatMessages and fills the log in one request', async () => {
    const events = Array.from({ length: 30 }, (_, n) => chatEvent(`c${n}`));
    const api = {
      hasMoreChatHistory: true,
      getChatMessages: vi.fn(async () => {
        api.hasMoreChatHistory = false;
        return { chunk: events, end: null };
      }),
      getMessages: vi.fn(), // unfiltered fallback must not be used
      hasMoreHistory: true,
    };
    const ui = /** @type {any} */ ({
      activityLog: [],
      _seenLogEventIds: new Set(),
      widgetManager: { getApi: () => api },
    });

    await backfillRecentHistory(ui, { minEntries: 25, maxPages: 12 });

    expect(ui.activityLog.length).toBeGreaterThanOrEqual(25);
    expect(api.getChatMessages).toHaveBeenCalledTimes(1);
    expect(api.getMessages).not.toHaveBeenCalled();
  });
});
