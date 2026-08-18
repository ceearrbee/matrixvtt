/**
 * End-to-end-ish: rolling a table from an open handout (the welcome-tour
 * scenario) must not open the EmojiPicker, regardless of whether
 * LogPanel is also mounted in the sidebar.
 *
 * The wikilink click handler in FloatingDoc.jsx explicitly
 * `stopPropagation`s so a stray bubble can't reach the LogPanel `+`
 * button.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';
import { act } from 'preact/test-utils';
import { FloatingDocs, openDoc, closeAllDocs } from '../ui/FloatingDoc.jsx';
import { LogPanel } from '../ui/LogPanel.jsx';
import { reactionsSignal } from '../state/signals.js';
import { logVersionSignal, replyContextSignal } from '../state/ui-signals.js';
import { withFacade } from './helpers/withFacade.js';

function makeUi() {
  const state = withFacade({
    isGM: () => true,
    handouts: new Map(),
    pages: new Map(),
    tables: new Map(),
    characters: new Map(),
    npcs: new Map(),
    items: new Map(),
    spells: new Map(),
    sendStateEvent: vi.fn().mockResolvedValue({}),
  });
  state.handouts.set('h-rumors', {
    title: 'Local Rumors',
    content: 'Pull a flavor hook each session: [[roll:tbl-rumors]]',
  });
  state.tables.set('tbl-rumors', {
    name: 'Local Rumors',
    entries: [{ weight: 1, text: 'Bandits on the road' }],
  });
  const ui = {
    state,
    activityLog: [{ eventId: 'evt-old', icon: '💬', text: 'old', html: 'old', ts: '12:00' }],
    widgetManager: { userId: '@me:example.com' },
    chat: { _send: vi.fn().mockResolvedValue() },
    rollTable: vi.fn(),
    openDoc: (kind, id) => openDoc(kind, id),
    closeDoc: vi.fn(),
    bringDocToFront: vi.fn(),
    _logSearch: '',
    _logFilter: 'all',
    _toast: vi.fn(),
    _log: vi.fn(),
  };
  return ui;
}

describe('handout roll wikilink does not open EmojiPicker', () => {
  let host;
  beforeEach(() => {
    closeAllDocs();
    host = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(host);
    reactionsSignal.value = new Map();
    replyContextSignal.value = null;
    logVersionSignal.value = 0;
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => {
    render(null, host);
    host.remove();
    closeAllDocs();
    vi.restoreAllMocks();
  });

  it('clicking the [[roll:…]] wikilink does not surface a picker', () => {
    const ui = makeUi();
    act(() => render(
      h('div', null, [h(LogPanel, { ui, key: 'log' }), h(FloatingDocs, { ui, key: 'docs' })]),
      host,
    ));
    act(() => { ui.openDoc('handout', 'h-rumors'); });
    const link = document.querySelector('a.wikilink[data-roll-table="tbl-rumors"]');
    expect(link).toBeTruthy();
    act(() => { link.click(); });
    expect(ui.rollTable).toHaveBeenCalledWith('tbl-rumors');
    expect(document.querySelector('.emoji-picker')).toBeNull();
    expect(document.querySelector('[role="dialog"][aria-label*="emoji" i]')).toBeNull();
  });
});
