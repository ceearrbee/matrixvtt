/**
 * Lock-in: clicking the 🎲 button in TablesPanel must not open the
 * EmojiPicker, even when LogPanel is also mounted in the page.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';
import { TablesPanel } from '../ui/gm/panels/TablesPanel.jsx';
import { LogPanel } from '../ui/LogPanel.jsx';
import { tablesSignal, reactionsSignal } from '../state/signals.js';
import { logVersionSignal, replyContextSignal } from '../state/ui-signals.js';
import { rollTable } from '../ui/tables/rollTable.js';
import { withFacade } from './helpers/withFacade.js';

function makeUi() {
  const state = withFacade({
    isGM: () => true,
    tables: new Map([
      ['tbl-1', { name: 'Loot', entries: [{ weight: 1, text: 'Old Boot' }] }],
    ]),
    items: new Map(),
    sendStateEvent: vi.fn().mockResolvedValue({}),
  });
  const ui = {
    state,
    activityLog: [
      { eventId: 'evt-1', icon: '💬', text: 'old', html: 'old', ts: '11:59' },
    ],
    widgetManager: { userId: '@me:example.com' },
    chat: { _send: vi.fn().mockResolvedValue() },
    rollTable: (id) => rollTable(ui, id),
    showTableForm: vi.fn(),
    deleteTable: vi.fn(),
    _toast: vi.fn(),
    _log: (icon, html) => {
      ui.activityLog.unshift({ icon, html, text: html, ts: '12:00', eventId: null });
    },
    _logSearch: '',
    _logFilter: 'all',
  };
  return ui;
}

describe('TablesPanel roll → no EmojiPicker', () => {
  let host;
  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
    reactionsSignal.value = new Map();
    replyContextSignal.value = null;
    logVersionSignal.value = 0;
    tablesSignal.value = new Map([
      ['tbl-1', { name: 'Loot', entries: [{ weight: 1, text: 'Old Boot' }] }],
    ]);
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => {
    render(null, host);
    host.remove();
    vi.restoreAllMocks();
  });

  it('clicking 🎲 on a table row does not open the EmojiPicker even with LogPanel mounted', () => {
    const ui = makeUi();
    // LogPanel mounted in a sibling div - simulates "sidebar shows
    // Log tab with prior messages while user rolls from elsewhere".
    const logHost = document.createElement('div');
    document.body.appendChild(logHost);
    render(h(LogPanel, { ui }), logHost);

    render(h(TablesPanel, { ui }), host);
    const rollBtn = host.querySelector('[data-roll-table="tbl-1"]');
    expect(rollBtn).toBeTruthy();
    rollBtn.click();

    expect(document.querySelector('.emoji-picker')).toBeNull();
    logHost.remove();
  });
});
