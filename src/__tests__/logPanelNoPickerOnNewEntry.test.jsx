/**
 * LogPanel - adding a new log entry must NOT auto-open the EmojiPicker.
 *
 * Lock-in regression for "rolling a table opens the emoji picker". The
 * picker should only mount on the per-row `+` button click; new entries
 * arriving (from a table roll, dice, chat) must never set
 * `pickerOpenForEventId` on their own.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, h } from 'preact';
import { LogPanel } from '../ui/LogPanel.jsx';
import { logVersionSignal, replyContextSignal } from '../state/ui-signals.js';
import { reactionsSignal } from '../state/signals.js';

function makeUi(activityLog) {
  return {
    activityLog,
    state: { isGM: () => true },
    widgetManager: { userId: '@me:example.com' },
    _logSearch: '',
    _logFilter: 'all',
  };
}

describe('LogPanel - picker is not auto-opened by new entries', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    reactionsSignal.value = new Map();
    replyContextSignal.value = null;
    logVersionSignal.value = 0;
  });
  afterEach(() => {
    render(null, host);
    host.remove();
  });

  it('does not mount EmojiPicker for any row when none of the + buttons have been clicked', () => {
    const log = [
      { eventId: 'evt-1', icon: '🎲', text: 'Loot - Bandits', html: 'Loot - Bandits', ts: '12:00' },
      { eventId: 'evt-2', icon: '💬', text: 'hi', html: 'hi', ts: '12:01' },
    ];
    render(h(LogPanel, { ui: makeUi(log) }), host);
    expect(host.querySelector('.emoji-picker')).toBeNull();
    expect(host.querySelector('[data-emoji-picker]')).toBeNull();
  });

  it('a fresh roll log entry (no eventId yet) renders without a picker', () => {
    // Local-echo entries arrive before the Matrix sync stamps an eventId.
    // The quick-react row gates on `e.eventId &&` (LogPanel.jsx:158); so
    // a no-eventId row should render no `+` button and therefore no
    // picker even if internal state were stale.
    const log = [{ icon: '🎲', text: 'Loot - Old Boot', html: 'Loot - Old Boot', ts: '12:02' }];
    render(h(LogPanel, { ui: makeUi(log) }), host);
    expect(host.querySelector('.log-actions__more')).toBeNull();
    expect(host.querySelector('.emoji-picker')).toBeNull();
  });
});
