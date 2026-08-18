/**
 * When history backfill exhausts its page budget in a Yjs-heavy room,
 * the log must say so instead of silently showing a truncated history.
 */
import { describe, it, expect, vi } from 'vitest';
import { backfillRecentHistory } from '../ui/log-panel.js';

function makeUi({ chunk = [] } = {}) {
  const api = {
    hasMoreChatHistory: true,
    getChatMessages: vi.fn().mockResolvedValue({ chunk }),
  };
  return {
    activityLog: [],
    _seenLogEventIds: new Set(),
    widgetManager: { getApi: () => api },
  };
}

describe('backfillRecentHistory budget notice', () => {
  it('appends a visible notice when the page budget runs out short of entries', async () => {
    globalThis.expectConsoleWarning(/history backfill hit the 2-page budget/);
    const ui = makeUi();
    await backfillRecentHistory(ui, { minEntries: 5, maxPages: 2 });

    const last = ui.activityLog[ui.activityLog.length - 1];
    expect(last).toBeDefined();
    expect(last.text).toMatch(/older messages/i);
  });

  it('adds no notice when the budget is not exhausted', async () => {
    const ui = makeUi();
    ui.widgetManager.getApi().hasMoreChatHistory = false;
    await backfillRecentHistory(ui, { minEntries: 5, maxPages: 2 });
    expect(ui.activityLog).toHaveLength(0);
  });
});
