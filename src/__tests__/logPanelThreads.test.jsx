/**
 * Threaded chat reply rendering in LogPanel.
 *
 * Replies with threadOf set are rendered inside a .log-thread-replies
 * container indented under their root message. The root shows a toggle
 * button. Non-threaded entries render flat. Orphan replies (no matching
 * root) render flat as fallback.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, h } from 'preact';
import { act } from 'preact/test-utils';
import { reactionsSignal } from '../state/signals.js';
import { LogPanel } from '../ui/LogPanel.jsx';

function makeUi(overrides = {}) {
  return {
    activityLog: [],
    _logSearch: '',
    _logFilter: 'all',
    widgetManager: null,
    ...overrides,
  };
}

describe('<LogPanel> threaded replies (D1-D3)', () => {
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

  const baseLog = [
    { icon: '💬', html: 'first', text: 'first', ts: '12:00', eventId: '$root', sender: '@a:m', threadOf: null },
    { icon: '💬', html: 'second', text: 'second', ts: '12:01', eventId: '$reply', sender: '@b:m', threadOf: '$root' },
    { icon: '💬', html: 'third', text: 'third', ts: '12:02', eventId: '$flat', sender: '@a:m', threadOf: null },
  ];

  it('renders top-level rows for $root and $flat but not $reply as a top-level row', () => {
    const ui = makeUi({ activityLog: baseLog });
    render(h(LogPanel, { ui }), host);

    // After the social redesign, top-level chat entries render inside
    // .log-msg (within .log-group) rather than .log-row. Replies still
    // live inside .log-thread-replies.
    const topMsgs = Array.from(host.querySelectorAll('.log-msg')).filter(
      (el) => !el.closest('.log-thread-replies'),
    );
    const ids = topMsgs.map((el) => el.dataset.eventId);
    expect(ids).toContain('$root');
    expect(ids).toContain('$flat');
    expect(ids).not.toContain('$reply');
  });

  it('renders $reply inside the .log-thread-replies of the $root row', () => {
    const ui = makeUi({ activityLog: baseLog });
    render(h(LogPanel, { ui }), host);

    const repliesContainer = host.querySelector('.log-thread-replies');
    expect(repliesContainer).toBeTruthy();

    const replyRow = repliesContainer.querySelector('[data-event-id="$reply"]');
    expect(replyRow).toBeTruthy();
  });

  it('reply row has padding-left indicating indentation', () => {
    const ui = makeUi({ activityLog: baseLog });
    render(h(LogPanel, { ui }), host);

    const repliesContainer = host.querySelector('.log-thread-replies');
    expect(repliesContainer).toBeTruthy();
    // The container itself carries the indent style
    expect(repliesContainer.style.paddingLeft).toBeTruthy();
  });

  it('root row shows a thread toggle with reply count', () => {
    const ui = makeUi({ activityLog: baseLog });
    render(h(LogPanel, { ui }), host);

    const toggle = host.querySelector('.log-thread-toggle');
    expect(toggle).toBeTruthy();
    expect(toggle.textContent).toMatch(/1 reply/);
  });

  it('clicking the thread toggle collapses the replies', async () => {
    const ui = makeUi({ activityLog: baseLog });
    render(h(LogPanel, { ui }), host);

    // Replies visible by default
    expect(host.querySelector('.log-thread-replies')).toBeTruthy();

    const toggle = host.querySelector('.log-thread-toggle');
    await act(async () => { toggle.click(); });

    // After collapse, replies container should be gone
    expect(host.querySelector('.log-thread-replies')).toBeFalsy();
  });

  it('clicking collapsed toggle expands replies again', async () => {
    const ui = makeUi({ activityLog: baseLog });
    render(h(LogPanel, { ui }), host);

    const toggle = host.querySelector('.log-thread-toggle');
    await act(async () => { toggle.click(); }); // collapse
    await act(async () => { toggle.click(); }); // expand

    expect(host.querySelector('.log-thread-replies')).toBeTruthy();
  });

  it('plural toggle label shows "N replies" for multiple replies', () => {
    const ui = makeUi({
      activityLog: [
        { icon: '💬', html: 'root', text: 'root', ts: '12:00', eventId: '$r', sender: '@a:m', threadOf: null },
        { icon: '💬', html: 'r1', text: 'r1', ts: '12:01', eventId: '$r1', sender: '@b:m', threadOf: '$r' },
        { icon: '💬', html: 'r2', text: 'r2', ts: '12:02', eventId: '$r2', sender: '@c:m', threadOf: '$r' },
      ],
    });
    render(h(LogPanel, { ui }), host);

    const toggle = host.querySelector('.log-thread-toggle');
    expect(toggle.textContent).toMatch(/2 replies/);
  });

  it('orphan reply (root not in top) renders flat', () => {
    const ui = makeUi({
      activityLog: [
        { icon: '💬', html: 'orphan', text: 'orphan', ts: '12:01', eventId: '$orphan', sender: '@b:m', threadOf: '$missing' },
        { icon: '💬', html: 'other', text: 'other', ts: '12:02', eventId: '$other', sender: '@a:m', threadOf: null },
      ],
    });
    render(h(LogPanel, { ui }), host);

    // No .log-thread-replies since there's no root to attach to
    expect(host.querySelector('.log-thread-replies')).toBeFalsy();

    // Orphan still appears as a top-level row
    const orphanRow = host.querySelector('[data-event-id="$orphan"]');
    expect(orphanRow).toBeTruthy();
    expect(orphanRow.closest('.log-thread-replies')).toBeFalsy();
  });

  it('replies also get reaction badges when reactions exist', () => {
    reactionsSignal.value = new Map([
      ['$reply', [{ key: '👍', count: 1, senders: ['@a:m'] }]],
    ]);
    const ui = makeUi({ activityLog: baseLog });
    render(h(LogPanel, { ui }), host);

    const repliesContainer = host.querySelector('.log-thread-replies');
    const badge = repliesContainer?.querySelector('.reaction-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe('👍 1');
  });
});
