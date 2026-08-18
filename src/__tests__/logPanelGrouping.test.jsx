/**
 * LogPanel - Discord-style author grouping.
 *
 * Consecutive entries from the same sender, within a 5-minute window,
 * and uninterrupted by a scene-root entry, collapse into ONE group
 * with a single header (color dot + display name + timestamp) and
 * stacked message bodies underneath. Synthetic entries (dice, combat,
 * map) never group - each gets its own row regardless.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup } from '@testing-library/preact';
import { LogPanel } from '../ui/LogPanel.jsx';
import { logVersionSignal, replyContextSignal } from '../state/ui-signals.js';
import { reactionsSignal } from '../state/signals.js';

function mkUi(entries) {
  return /** @type {any} */ ({
    activityLog: entries,
    _logSearch: '', _logFilter: 'all',
    widgetManager: { userId: '@me:m', getApi: () => null },
    state: { sendRoomEvent: async () => {} },
  });
}

function entry(over) {
  return {
    icon: '💬',
    html: `<b>${over.sender ?? '@u:m'}</b>: ${over.text ?? 'hi'}`,
    text: over.text ?? 'hi',
    ts: over.ts ?? '14:00',
    eventId: over.eventId ?? `e-${Math.random().toString(36).slice(2)}`,
    sender: over.sender ?? '@u:m',
    threadOf: null,
    isSceneRoot: false,
    sceneTitle: null,
    long: false,
    ...over,
  };
}

beforeEach(() => {
  logVersionSignal.value = 0;
  replyContextSignal.value = null;
  reactionsSignal.value = new Map();
});
afterEach(() => { cleanup(); });

describe('LogPanel author grouping', () => {
  it('collapses two consecutive same-sender entries into one group', () => {
    const ui = mkUi([
      entry({ sender: '@aria:m', ts: '14:00', text: 'hello' }),
      entry({ sender: '@aria:m', ts: '14:01', text: 'there' }),
    ]);
    const { container } = render(h(LogPanel, { ui }));
    expect(container.querySelectorAll('.log-group').length).toBe(1);
    expect(container.querySelectorAll('.log-group__header').length).toBe(1);
    expect(container.querySelectorAll('.log-msg').length).toBe(2);
  });

  it('different senders split into separate groups', () => {
    const ui = mkUi([
      entry({ sender: '@aria:m', ts: '14:00' }),
      entry({ sender: '@kael:m', ts: '14:01' }),
    ]);
    const { container } = render(h(LogPanel, { ui }));
    expect(container.querySelectorAll('.log-group').length).toBe(2);
  });

  it('time gap over 5 minutes breaks the group', () => {
    const ui = mkUi([
      entry({ sender: '@aria:m', ts: '14:00' }),
      entry({ sender: '@aria:m', ts: '14:10' }),
    ]);
    const { container } = render(h(LogPanel, { ui }));
    expect(container.querySelectorAll('.log-group').length).toBe(2);
  });

  it('scene-root interrupts grouping (starts a fresh conversation)', () => {
    const ui = mkUi([
      entry({ sender: '@aria:m', ts: '14:00' }),
      entry({ sender: '@aria:m', ts: '14:01', isSceneRoot: true, sceneTitle: 'The Sunken Keep' }),
      entry({ sender: '@aria:m', ts: '14:02' }),
    ]);
    const { container } = render(h(LogPanel, { ui }));
    // The scene-root entry itself is NOT in a group (it's a card).
    // The two non-root entries should be in two separate groups (the
    // scene break interrupted them).
    expect(container.querySelectorAll('.log-group').length).toBe(2);
    expect(container.querySelector('.log-scene-card')).not.toBeNull();
  });

  it('synthetic entries (dice, combat, damage) never group with chat', () => {
    const ui = mkUi([
      entry({ sender: '@aria:m', ts: '14:00', icon: '💬', text: 'attack' }),
      entry({ sender: null, ts: '14:00', icon: '🎲', text: 'd20 = 18' }),
      entry({ sender: '@aria:m', ts: '14:00', icon: '💬', text: 'critical!' }),
    ]);
    const { container } = render(h(LogPanel, { ui }));
    // Two chat groups (the dice in the middle broke them) + one synthetic row.
    expect(container.querySelectorAll('.log-group').length).toBe(2);
    expect(container.querySelectorAll('.log-synth-row').length).toBe(1);
  });
});
