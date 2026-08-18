/**
 * Outbound writes should fail the same schema validation the inbound
 * syncer enforces. Today `sendStateEvent` only dedups + size-checks;
 * validation happens on the incoming path after the fact, so a UI bug
 * can push genuinely invalid state to the server and pollute the room.
 *
 * Pre-write validation closes that gap: the same validator runs,
 * invalid writes throw, and the caller surfaces the error.
 */
import { describe, it, expect, vi } from 'vitest';
import { sendStateEvent } from '../queue.js';
import { EVENT_TYPES } from '../../utils/constants.js';

function makeMockSm() {
  return {
    widgetManager: {
      sendStateEvent: vi.fn().mockResolvedValue({ event_id: '$ok' }),
    },
    lastSentState: new Map(),
    _retryQueue: new Map(),
    _drainTimer: null,
    notifyUpdate: vi.fn(),
    settings: { systemConfig: null },
  };
}

describe('sendStateEvent - outbound validation', () => {
  it('rejects a token write missing required id before hitting the network', async () => {
    const sm = makeMockSm();
    const bad = { /* no id */ col: 0, row: 0, sheet_id: null };
    await expect(sendStateEvent(sm, EVENT_TYPES.TOKEN, 'tok-x', bad)).rejects.toThrow(/Token must have id/);
    expect(sm.widgetManager.sendStateEvent).not.toHaveBeenCalled();
  });

  it('rejects a spell with a non-integer level before hitting the network', async () => {
    const sm = makeMockSm();
    const bad = { name: 'Fireball', level: 3.5 };
    await expect(sendStateEvent(sm, EVENT_TYPES.SPELL, 'spl-x', bad)).rejects.toThrow();
    expect(sm.widgetManager.sendStateEvent).not.toHaveBeenCalled();
  });

  it('allows a well-formed token through to the transport', async () => {
    const sm = makeMockSm();
    const ok = { id: 'tok-1', map_id: 'm1', col: 0, row: 0, sheet_id: null };
    await sendStateEvent(sm, EVENT_TYPES.TOKEN, 'tok-1', ok);
    expect(sm.widgetManager.sendStateEvent).toHaveBeenCalledWith(EVENT_TYPES.TOKEN, 'tok-1', ok);
  });

  it('allows an empty-content tombstone through regardless of validator', async () => {
    const sm = makeMockSm();
    await sendStateEvent(sm, EVENT_TYPES.TOKEN, 'tok-1', {});
    expect(sm.widgetManager.sendStateEvent).toHaveBeenCalledWith(EVENT_TYPES.TOKEN, 'tok-1', {});
  });
});
