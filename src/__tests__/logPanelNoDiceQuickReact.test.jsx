/**
 * LogPanel - no dice/sword quick-react buttons.
 *
 * The 🎲 and ⚔️ quick-react buttons were the picker-on-roll footgun:
 * after a roll the GM would re-target the table's roll button and miss-
 * click the adjacent `+` reaction button (which sits next to the dice
 * quick-react). Removing 🎲 and ⚔️ from the per-entry quick-react row
 * eliminates the misclick path. Real reactions (👍 👎 ❤️ 😂) and the
 * full picker behind `+` are unaffected.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, h } from 'preact';
import { LogPanel } from '../ui/LogPanel.jsx';
import { reactionsSignal } from '../state/signals.js';
import { logVersionSignal, replyContextSignal } from '../state/ui-signals.js';

function makeUi(activityLog) {
  return {
    activityLog,
    state: { isGM: () => true },
    widgetManager: { userId: '@me:example.com' },
    _logSearch: '',
    _logFilter: 'all',
  };
}

describe('LogPanel - no 🎲 / ⚔️ quick-react buttons', () => {
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

  it('a chat entry with eventId renders no dice or sword quick-react button', () => {
    const log = [{ eventId: 'evt-1', icon: '💬', text: 'hi', html: 'hi', ts: '12:00' }];
    render(h(LogPanel, { ui: makeUi(log) }), host);
    const buttons = [...host.querySelectorAll('.log-actions__react')].map(b => b.textContent);
    expect(buttons).not.toContain('🎲');
    expect(buttons).not.toContain('⚔️');
    // Real reactions still render.
    expect(buttons).toEqual(expect.arrayContaining(['👍', '👎', '❤️', '😂']));
  });
});

describe('LogPanel - synthesised dice/combat entries get no quick-react row', () => {
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

  it('a 🎲 entry with eventId still renders no `+` reaction button', () => {
    const log = [
      {
        eventId: 'evt-roll',
        icon: '🎲',
        text: 'Loot - Old Boot',
        html: 'Loot - Old Boot',
        ts: '12:00',
      },
    ];
    render(h(LogPanel, { ui: makeUi(log) }), host);
    expect(host.querySelector('.log-actions__more')).toBeNull();
    expect(host.querySelector('.log-actions__react')).toBeNull();
  });

  it('a ⚔️ entry with eventId still renders no `+` reaction button', () => {
    const log = [{ eventId: 'evt-atk', icon: '⚔️', text: 'attack', html: 'attack', ts: '12:00' }];
    render(h(LogPanel, { ui: makeUi(log) }), host);
    expect(host.querySelector('.log-actions__more')).toBeNull();
  });
});
