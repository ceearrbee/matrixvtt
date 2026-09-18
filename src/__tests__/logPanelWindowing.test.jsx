/**
 * The log renders what you can see, not everything it holds.
 *
 * `ui.activityLog` is capped at 2000 entries and the feed mapped every
 * one of them, giving each message a six-button hover toolbar. At the
 * cap that is ~32,000 DOM nodes and ~12,000 buttons - and the toolbars
 * are hidden with `opacity: 0`, not `display: none`, so all 12,000 sit
 * in the tab order and in the screen-reader tree. Every incoming
 * message re-rendered the lot.
 *
 * Two rules now bound it: the feed renders a window of the newest items
 * with a control to reach back further, and a row's action toolbar
 * renders for the row the pointer or keyboard is actually on. Each row
 * keeps one always-present trigger so a keyboard user can still get
 * there, and so focus survives the toolbar appearing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { h } from 'preact';
import { LogPanel, LOG_WINDOW_SIZE } from '../ui/LogPanel.jsx';

function makeUi(n) {
  const activityLog = [];
  for (let i = 0; i < n; i++) {
    activityLog.push({
      icon: '💬', html: `msg ${i}`, text: `msg ${i}`, ts: '12:00',
      eventId: `$e${i}`, sender: `@u${i}:hs`, threadOf: null,
      isSceneRoot: false, sceneTitle: null, long: false, msgtype: 'm.text',
    });
  }
  return /** @type {any} */ ({
    activityLog,
    state: { isGM: () => true, tokens: new Map(), characters: new Map() },
    widgetManager: { userId: '@me:hs', roomId: '!r:hs', getApi: () => null },
  });
}

const rows = (c) => c.querySelectorAll('.log-msg');
const earlier = (c) => c.querySelector('[data-log-earlier]');

describe('log feed windowing', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(cleanup);

  it('renders only a window of the newest items on a long backlog', () => {
    const { container } = render(h(LogPanel, { ui: makeUi(LOG_WINDOW_SIZE * 4) }));
    expect(rows(container).length).toBe(LOG_WINDOW_SIZE);
  });

  it('keeps the newest end of the log, which is where the conversation is', () => {
    const n = LOG_WINDOW_SIZE * 2;
    const { container } = render(h(LogPanel, { ui: makeUi(n) }));
    // activityLog is newest-first, so entry 0 is the most recent.
    expect(container.textContent).toContain('msg 0');
    expect(container.textContent).not.toContain(`msg ${n - 1}`);
  });

  it('offers a way back to the earlier entries it is holding', () => {
    const { container } = render(h(LogPanel, { ui: makeUi(LOG_WINDOW_SIZE * 3) }));
    expect(earlier(container)).not.toBeNull();
    fireEvent.click(earlier(container));
    expect(rows(container).length).toBeGreaterThan(LOG_WINDOW_SIZE);
  });

  it('shows no window control when the whole log already fits', () => {
    const { container } = render(h(LogPanel, { ui: makeUi(5) }));
    expect(rows(container).length).toBe(5);
    expect(earlier(container)).toBeNull();
  });

  it('drops the window control once everything is on screen', () => {
    const { container } = render(h(LogPanel, { ui: makeUi(Math.floor(LOG_WINDOW_SIZE * 1.5)) }));
    fireEvent.click(earlier(container));
    expect(earlier(container)).toBeNull();
  });
});

describe('row action toolbars follow the pointer', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(cleanup);

  it('renders one trigger per row, not a full toolbar per row', () => {
    const { container } = render(h(LogPanel, { ui: makeUi(20) }));
    expect(container.querySelectorAll('[data-log-actions-trigger]').length).toBe(20);
    expect(container.querySelectorAll('.log-actions__react').length).toBe(0);
  });

  it('opens the toolbar for the row the pointer is on, and only that row', () => {
    const { container } = render(h(LogPanel, { ui: makeUi(20) }));
    fireEvent.pointerEnter(container.querySelector('[data-event-id="$e3"]'));
    const open = container.querySelectorAll('[data-event-id="$e3"] .log-actions__react');
    expect(open.length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.log-actions__react').length).toBe(open.length);
  });

  it('opens the toolbar from the keyboard, and keeps the trigger so focus survives', () => {
    const { container } = render(h(LogPanel, { ui: makeUi(20) }));
    const row = container.querySelector('[data-event-id="$e3"]');
    const trigger = row.querySelector('[data-log-actions-trigger]');
    fireEvent.focusIn(trigger);
    expect(row.querySelectorAll('.log-actions__react').length).toBeGreaterThan(0);
    expect(row.querySelector('[data-log-actions-trigger]')).not.toBeNull();
  });

  it('keeps the whole feed light enough to tab through', () => {
    const { container } = render(h(LogPanel, { ui: makeUi(2000) }));
    expect(container.querySelectorAll('button').length).toBeLessThan(400);
    expect(container.querySelectorAll('*').length).toBeLessThan(4000);
  });
});
