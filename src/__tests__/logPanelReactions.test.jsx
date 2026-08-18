/**
 * LogPanel reaction badge rendering tests.
 *
 * B6-B7: Aggregated reactions from reactionsSignal rendered as .reaction-badge
 * elements under each chat row that carries an eventId.
 * C3-C4: Quick-react bar, EmojiPicker integration, badge toggle/redact.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';
import { act } from 'preact/test-utils';
import { reactionsSignal } from '../state/signals.js';
import { LogPanel } from '../ui/LogPanel.jsx';

function makeUi(entries, widgetManager = null) {
  return {
    activityLog: entries,
    _logSearch: '',
    _logFilter: 'all',
    widgetManager,
    state: { sendRoomEvent: widgetManager?.sendRoomEvent ?? vi.fn() },
  };
}

function makeWidgetManager(overrides = {}) {
  return {
    userId: '@me:m',
    sendRoomEvent: vi.fn().mockResolvedValue({ event_id: '$x' }),
    redactEvent: vi.fn().mockResolvedValue({}),
    getApi: vi.fn().mockReturnValue(null),
    ...overrides,
  };
}

describe('<LogPanel> reaction badges', () => {
  let host;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    reactionsSignal.value = new Map();
  });

  afterEach(() => {
    render(null, host);
    host.remove();
    reactionsSignal.value = new Map();
  });

  it('renders one badge per aggregated reaction when eventId is present', () => {
    reactionsSignal.value = new Map([
      [
        '$msg1',
        [
          { key: '👍', count: 2, senders: ['@a:m', '@b:m'] },
          { key: '🔥', count: 1, senders: ['@a:m'] },
        ],
      ],
    ]);

    const ui = makeUi([
      {
        icon: '💬',
        html: 'hello',
        text: 'hello',
        ts: '12:00',
        eventId: '$msg1',
        sender: '@a:m',
      },
    ]);

    render(h(LogPanel, { ui }), host);

    const badges = host.querySelectorAll('.reaction-badge');
    expect(badges.length).toBe(2);

    const texts = Array.from(badges).map((b) => b.textContent);
    expect(texts).toContain('👍 2');
    expect(texts).toContain('🔥 1');
  });

  it('renders no badges when entry has no eventId (synthesized log line)', () => {
    reactionsSignal.value = new Map([['$msg1', [{ key: '👍', count: 1, senders: ['@a:m'] }]]]);

    const ui = makeUi([
      {
        icon: '🎲',
        html: 'rolled 18',
        text: 'rolled 18',
        ts: '12:01',
        eventId: null,
        sender: null,
      },
    ]);

    render(h(LogPanel, { ui }), host);

    expect(host.querySelectorAll('.reaction-badge').length).toBe(0);
  });

  it('renders no badges when reactionsSignal has no entry for the eventId', () => {
    reactionsSignal.value = new Map();

    const ui = makeUi([
      {
        icon: '💬',
        html: 'no reactions',
        text: 'no reactions',
        ts: '12:02',
        eventId: '$msg2',
        sender: '@a:m',
      },
    ]);

    render(h(LogPanel, { ui }), host);

    expect(host.querySelectorAll('.reaction-badge').length).toBe(0);
  });
});

// ─── C3-C4: Quick-react bar, picker, badge toggle ────────────────────────────

describe('<LogPanel> quick-react bar (C3-C4)', () => {
  let host;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    reactionsSignal.value = new Map();
  });

  afterEach(() => {
    render(null, host);
    host.remove();
    reactionsSignal.value = new Map();
  });

  it('renders 4 reaction quick-react buttons under a chat row that has eventId', () => {
    // 🎲 and ⚔️ were removed from QUICK_REACTS - they're action-shaped icons,
    // not reactions, and sat adjacent to the picker `+` causing misclicks.
    const ui = makeUi(
      [{ icon: '💬', html: 'hello', text: 'hello', ts: '12:00', eventId: '$msg1', sender: '@a:m' }],
      makeWidgetManager(),
    );
    render(h(LogPanel, { ui }), host);
    const buttons = host.querySelectorAll('.log-actions .log-actions__react');
    expect(buttons.length).toBe(4);
  });

  it('does not render quick-react bar on synthesized log entries (no eventId)', () => {
    const ui = makeUi(
      [{ icon: '🎲', html: 'roll', text: 'roll', ts: '12:00', eventId: null, sender: null }],
      makeWidgetManager(),
    );
    render(h(LogPanel, { ui }), host);
    expect(host.querySelectorAll('.log-actions').length).toBe(0);
  });

  it('clicking 👍 sends m.reaction with correct shape', async () => {
    const wm = makeWidgetManager();
    const ui = makeUi(
      [{ icon: '💬', html: 'hello', text: 'hello', ts: '12:00', eventId: '$msg1', sender: '@a:m' }],
      wm,
    );
    render(h(LogPanel, { ui }), host);

    const thumbBtn = Array.from(host.querySelectorAll('.log-actions__react')).find(
      (b) => b.textContent === '👍',
    );
    expect(thumbBtn).toBeTruthy();
    await act(async () => { thumbBtn.click(); });

    expect(wm.sendRoomEvent).toHaveBeenCalledWith('m.reaction', {
      'm.relates_to': { rel_type: 'm.annotation', event_id: '$msg1', key: '👍' },
    });
  });

  it('renders a + button under chat rows with eventId', () => {
    const ui = makeUi(
      [{ icon: '💬', html: 'hi', text: 'hi', ts: '12:00', eventId: '$msg1', sender: '@a:m' }],
      makeWidgetManager(),
    );
    render(h(LogPanel, { ui }), host);
    expect(host.querySelector('.log-actions__more')).toBeTruthy();
  });

  it('clicking + opens EmojiPicker', async () => {
    const ui = makeUi(
      [{ icon: '💬', html: 'hi', text: 'hi', ts: '12:00', eventId: '$msg1', sender: '@a:m' }],
      makeWidgetManager(),
    );
    render(h(LogPanel, { ui }), host);
    const plusBtn = host.querySelector('.log-actions__more');
    await act(async () => { plusBtn.click(); });
    expect(host.querySelector('.emoji-picker')).toBeTruthy();
  });

  it('picking an emoji from picker sends m.reaction and closes picker', async () => {
    const wm = makeWidgetManager();
    const ui = makeUi(
      [{ icon: '💬', html: 'hi', text: 'hi', ts: '12:00', eventId: '$msg1', sender: '@a:m' }],
      wm,
    );
    render(h(LogPanel, { ui }), host);

    const plusBtn = host.querySelector('.log-actions__more');
    await act(async () => { plusBtn.click(); });

    const firstEmoji = host.querySelector('.emoji-cell');
    expect(firstEmoji).toBeTruthy();
    await act(async () => { firstEmoji.click(); });

    expect(wm.sendRoomEvent).toHaveBeenCalledWith('m.reaction', expect.objectContaining({
      'm.relates_to': expect.objectContaining({ rel_type: 'm.annotation', event_id: '$msg1' }),
    }));
    expect(host.querySelector('.emoji-picker')).toBeFalsy();
  });
});

describe('<LogPanel> badge toggle (C3-C4)', () => {
  let host;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    reactionsSignal.value = new Map();
  });

  afterEach(() => {
    render(null, host);
    host.remove();
    reactionsSignal.value = new Map();
  });

  it('clicking own reaction badge calls redactEvent', async () => {
    const wm = makeWidgetManager();
    reactionsSignal.value = new Map([
      ['$msg1', [{ key: '🔥', count: 1, senders: ['@me:m'], myReactionEventId: '$react1' }]],
    ]);
    const ui = makeUi(
      [{ icon: '💬', html: 'hi', text: 'hi', ts: '12:00', eventId: '$msg1', sender: '@other:m' }],
      wm,
    );
    render(h(LogPanel, { ui }), host);

    const badge = host.querySelector('.reaction-badge');
    expect(badge).toBeTruthy();
    await act(async () => { badge.click(); });

    expect(wm.redactEvent).toHaveBeenCalledWith('$react1');
    expect(wm.sendRoomEvent).not.toHaveBeenCalled();
  });

  it('clicking someone else reaction badge sends m.reaction', async () => {
    const wm = makeWidgetManager();
    reactionsSignal.value = new Map([
      ['$msg1', [{ key: '👍', count: 1, senders: ['@other:m'] }]],
    ]);
    const ui = makeUi(
      [{ icon: '💬', html: 'hi', text: 'hi', ts: '12:00', eventId: '$msg1', sender: '@other:m' }],
      wm,
    );
    render(h(LogPanel, { ui }), host);

    const badge = host.querySelector('.reaction-badge');
    await act(async () => { badge.click(); });

    expect(wm.sendRoomEvent).toHaveBeenCalledWith('m.reaction', {
      'm.relates_to': { rel_type: 'm.annotation', event_id: '$msg1', key: '👍' },
    });
    expect(wm.redactEvent).not.toHaveBeenCalled();
  });
});
