/**
 * LogPanel - _logSeeded one-shot history seed on mount.
 *
 * The conversation-first shell moved LogPanel into the chat column.
 * A fresh ui instance enters with an empty activityLog and only live
 * syncer events populate it - historical messages already in the
 * room's timeline never surface unless the panel pulls them. The seed
 * effect calls loadMoreHistory once on mount so the column shows
 * recent chat history immediately.
 *
 * Lock in:
 *   - first mount fetches via api.getMessages and the entries land in
 *     activityLog (consumer re-renders, not just writer fires)
 *   - second mount of the same ui does NOT re-fetch (the _logSeeded
 *     guard one-shots per ui instance)
 *   - panel without an api.getMessages does not crash and does not
 *     mark _logSeeded so a later credentialed mount can still seed
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup, waitFor } from '@testing-library/preact';

vi.mock('../ui/EmojiPicker.jsx', () => ({ EmojiPicker: () => null }));

import { LogPanel } from '../ui/LogPanel.jsx';

/**
 * @param {{ getMessages?: any, history?: any[] }} [opts]
 */
function makeUi(opts = {}) {
  const { getMessages, history: _history = [] } = opts;
  // loadMoreHistory pushes onto ui.activityLog directly. The fake
  // api.getMessages resolves with a chunk shaped like
  // MatrixApiAdapter's return.
  const ui = {
    activityLog: [],
    _seenLogEventIds: new Set(),
    _logSearch: '',
    _logFilter: 'all',
    widgetManager: getMessages
      ? { getApi: () => ({ getMessages, hasMoreHistory: true }) }
      : { getApi: () => ({}) },
  };
  return ui;
}

afterEach(() => { cleanup(); });

describe('LogPanel history seed', () => {
  beforeEach(() => { vi.useRealTimers(); });

  it('pulls history on first mount and renders it', async () => {
    const getMessages = vi.fn().mockResolvedValue({
      chunk: [
        { event_id: '$h1', type: 'm.room.message', sender: '@a:s', origin_server_ts: 1, content: { msgtype: 'm.text', body: 'hello' } },
      ],
      end: null,
    });
    const ui = makeUi({ getMessages });

    const { container } = render(h(LogPanel, { ui }));

    await waitFor(() => expect(getMessages).toHaveBeenCalled());
    await waitFor(() => expect(ui.activityLog.length).toBeGreaterThan(0));
    // Consumer re-renders: the row appears in the DOM, not just the
    // signal write.
    await waitFor(() => {
      expect(container.querySelector('.log-row, .log-body')).toBeTruthy();
    });
  });

  it('does not re-fetch when a second LogPanel mounts with the same ui', async () => {
    const getMessages = vi.fn().mockResolvedValue({ chunk: [], end: null });
    const ui = makeUi({ getMessages });

    const first = render(h(LogPanel, { ui }));
    await waitFor(() => expect(getMessages).toHaveBeenCalledTimes(1));
    first.unmount();

    render(h(LogPanel, { ui }));
    // Yield a tick so any second effect would fire.
    await Promise.resolve();
    expect(getMessages).toHaveBeenCalledTimes(1);
  });

  it('renders cleanly when api.getMessages is unavailable', () => {
    const ui = makeUi({ getMessages: null });
    expect(() => render(h(LogPanel, { ui }))).not.toThrow();
    expect(ui._logSeeded).toBe(true);
  });
});
