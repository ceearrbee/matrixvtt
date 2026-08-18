/**
 * StateManager helper methods the UI layer depends on:
 *   - cancelDebouncedSend(type, stateKey)  - used by fog toggle / reveal
 *   - hasTokenForSheet(sheetId)            - used by character-sheet UI
 */

import { describe, it, expect, vi } from 'vitest';
import { StateManager } from '../StateManager.js';
import { createMockWidgetManager } from '../../../tests/mocks/widgetManager.mock.js';

vi.mock('../../widget/SubscriptionManager.js', () => ({
  SubscriptionManager: class {
    subscribe() {} unsubscribeAll() {} destroy() {}
  }
}));

function makeSM() {
  const wm = createMockWidgetManager({ isStandalone: true });
  return new StateManager(wm);
}

describe('StateManager.cancelDebouncedSend', () => {
  it('clears a pending debounced send so the network call never fires', () => {
    vi.useFakeTimers();
    const sm = makeSM();
    sm.sendStateEvent = vi.fn().mockResolvedValue(undefined);

    sm.debouncedSend('com.vtt.fog', '', { mode: 'hidden' }, 400);
    sm.cancelDebouncedSend('com.vtt.fog', '');

    vi.advanceTimersByTime(500);
    expect(sm.sendStateEvent).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('is a no-op when no pending send exists', () => {
    const sm = makeSM();
    expect(() => sm.cancelDebouncedSend('com.vtt.fog', '')).not.toThrow();
  });
});

describe('StateManager.hasTokenForSheet', () => {
  it('returns true when any token references the sheet id', () => {
    const sm = makeSM();
    sm.tokens.set('tok-1', { id: 'tok-1', sheet_id: 'chr-aria' });
    sm.tokens.set('tok-2', { id: 'tok-2', sheet_id: 'npc-orc' });

    expect(sm.hasTokenForSheet('chr-aria')).toBe(true);
    expect(sm.hasTokenForSheet('npc-orc')).toBe(true);
  });

  it('returns false when no token references the sheet id', () => {
    const sm = makeSM();
    sm.tokens.set('tok-1', { id: 'tok-1', sheet_id: 'chr-other' });
    expect(sm.hasTokenForSheet('chr-aria')).toBe(false);
  });

  it('returns false for empty collection', () => {
    const sm = makeSM();
    expect(sm.hasTokenForSheet('anything')).toBe(false);
  });
});

describe('StateManager.isTokenVisibleToPlayer', () => {
  it('exists as a facade method and delegates to the reader', () => {
    const sm = makeSM();
    expect(typeof sm.isTokenVisibleToPlayer).toBe('function');
    sm.settings = { gm_user_ids: [] };
    sm.fog = { mode: 'hidden', revealed: [] };
    const hidden = { id: 't1', col: 0, row: 0, owner_user_id: '@someone-else:m', visible: true };
    expect(sm.isTokenVisibleToPlayer(hidden, new Set())).toBe(false);
    expect(sm.isTokenVisibleToPlayer(hidden, new Set(['0,0']))).toBe(true);
  });
});
