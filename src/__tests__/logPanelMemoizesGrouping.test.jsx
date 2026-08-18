/**
 * LogPanel re-renders on emoji-picker opens, thread collapses and
 * long-message expands. None of those change the grouped output, and
 * running the filter + thread-group + author-group pipeline inline on
 * every render walks up to MAX_LOG_ENTRIES (2000) entries three times
 * per click. This pins the memo so it can't silently regress.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';
import { act } from 'preact/test-utils';
import { reactionsSignal } from '../state/signals.js';
import { logVersionSignal } from '../state/ui-signals.js';

const buildSpy = vi.fn();
vi.mock('../ui/log-grouping.js', async (importOriginal) => {
  const actual = /** @type {any} */ (await importOriginal());
  return {
    ...actual,
    buildLogItems: (...args) => {
      buildSpy(...args);
      return actual.buildLogItems(...args);
    },
  };
});

const { LogPanel } = await import('../ui/LogPanel.jsx');

function makeUi(entryCount = 3) {
  const activityLog = [];
  for (let i = 0; i < entryCount; i++) {
    activityLog.push({
      icon: '💬', eventId: `e${i}`, sender: `@u${i}:s`,
      text: `msg ${i}`, html: `msg ${i}`, ts: '10:00',
    });
  }
  return {
    activityLog,
    _logSearch: '',
    _logFilter: 'all',
    widgetManager: null,
    state: { sendRoomEvent: vi.fn().mockResolvedValue(undefined) },
  };
}

describe('<LogPanel> grouping memoization', () => {
  let host;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    reactionsSignal.value = new Map();
    buildSpy.mockClear();
  });

  afterEach(() => {
    render(null, host);
    host.remove();
    reactionsSignal.value = new Map();
  });

  it('does not re-group when only local picker state changes', async () => {
    const ui = makeUi();
    await act(async () => { render(h(LogPanel, { ui }), host); });
    expect(buildSpy).toHaveBeenCalledTimes(1);

    const more = host.querySelector('.log-actions__more');
    expect(more).toBeTruthy();
    await act(async () => { more.click(); });

    expect(buildSpy).toHaveBeenCalledTimes(1);
  });

  it('re-groups when the log version signal advances', async () => {
    const ui = makeUi();
    await act(async () => { render(h(LogPanel, { ui }), host); });
    expect(buildSpy).toHaveBeenCalledTimes(1);

    ui.activityLog.unshift({
      icon: '💬', eventId: 'new', sender: '@new:s',
      text: 'fresh', html: 'fresh', ts: '10:05',
    });
    await act(async () => { logVersionSignal.value = logVersionSignal.value + 1; });

    expect(buildSpy).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('fresh');
  });
});
