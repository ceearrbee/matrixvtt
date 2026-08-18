/**
 * Regression for "opening the Log tab pops up an emoji picker you
 * can't close." LogPanel rendered the picker when
 * `pickerOpenForEventId === e.eventId`. The initial state is `null`,
 * and synth log entries (dice rolls / damage / heal / combat
 * announcements) have `eventId: null`, so the equality is `null ===
 * null` for every synth entry on first mount - N pickers render at
 * once. anchorRect is also null, so the picker positions itself in
 * the center of the screen via translate(-50%, -50%). Closing one
 * sets state back to null, which still matches every synth entry, so
 * it can never actually unmount.
 *
 * Fix: gate the render on `e.eventId` being truthy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, h } from 'preact';
import { LogPanel } from '../ui/LogPanel.jsx';
import { logVersionSignal, replyContextSignal } from '../state/ui-signals.js';
import { reactionsSignal } from '../state/signals.js';

beforeEach(() => {
  document.body.innerHTML = '';
  replyContextSignal.value = null;
  reactionsSignal.value = new Map();
  logVersionSignal.value = 0;
});

function makeUi(activityLog = []) {
  return {
    activityLog,
    state: { isGM: () => true, getCurrentCharacter: () => null },
    widgetManager: { userId: '@me:hs' },
    _logFilter: 'all',
    _logSearch: '',
    _logLoadingHistory: false,
    _seenLogEventIds: new Set(),
  };
}

function mount(vnode) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  render(vnode, root);
  return root;
}

describe('LogPanel does not spawn pickers for synth entries on mount', () => {
  it('with three synth entries (eventId:null), no EmojiPicker renders', () => {
    const ui = makeUi([
      { icon: '🎲', html: '1d20 → 18', text: '1d20 → 18', ts: '12:00', eventId: null, sender: null, threadOf: null },
      { icon: '⚔️', html: 'Round 1', text: 'Round 1', ts: '12:01', eventId: null, sender: null, threadOf: null },
      { icon: '💔', html: '5 damage', text: '5 damage', ts: '12:02', eventId: null, sender: null, threadOf: null },
    ]);
    const root = mount(h(LogPanel, { ui }));
    expect(root.querySelectorAll('.emoji-picker').length).toBe(0);
  });

  it('with a real chat entry (eventId set) but no user click, no picker renders', () => {
    const ui = makeUi([
      { icon: '💬', html: '<b>Alice</b>: hi', text: 'Alice: hi', ts: '12:00',
        eventId: '$abc:matrix.org', sender: '@alice:m.org', threadOf: null },
    ]);
    const root = mount(h(LogPanel, { ui }));
    expect(root.querySelectorAll('.emoji-picker').length).toBe(0);
  });

  it('mixed entries: still zero pickers on mount', () => {
    const ui = makeUi([
      { icon: '🎲', html: 'r', text: 'r', ts: '12:00', eventId: null, sender: null, threadOf: null },
      { icon: '💬', html: 'm', text: 'm', ts: '12:01', eventId: '$x:m', sender: '@a:m', threadOf: null },
      { icon: '💚', html: 'h', text: 'h', ts: '12:02', eventId: null, sender: null, threadOf: null },
    ]);
    const root = mount(h(LogPanel, { ui }));
    expect(root.querySelectorAll('.emoji-picker').length).toBe(0);
  });
});
