/**
 * Power-level enforcement on the outbound queue (ROADMAP 2.7/2.8).
 *
 * sendStateEvent must refuse types the user lacks power for, throwing
 * a PERMISSION error instead of queuing a guaranteed-403 send.
 */
import { describe, it, expect, vi } from 'vitest';
import { sendStateEvent } from '../queue.js';
import { EVENT_TYPES } from '../../utils/constants.js';

function makeSm({ userId = '@p:m', powerLevels = null } = {}) {
  return {
    widgetManager: {
      userId,
      sendStateEvent: vi.fn().mockResolvedValue({}),
    },
    settings: { gm_user_ids: [] },
    powerLevels,
    lastSentState: new Map(),
    _retryQueue: new Map(),
  };
}

describe('sendStateEvent power-level filter', () => {
  it('rejects an event the user lacks power for, without calling the underlying transport', async () => {
    const sm = makeSm({
      userId: '@p:m',
      powerLevels: { users_default: 0, events: { [EVENT_TYPES.WALL]: 50 } },
    });
    await expect(
      sendStateEvent(sm, EVENT_TYPES.WALL, 'w1', { id: 'w1', p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } })
    ).rejects.toThrow(/permission/i);
    expect(sm.widgetManager.sendStateEvent).not.toHaveBeenCalled();
  });

  it('allows an event the user has power for', async () => {
    const sm = makeSm({
      userId: '@gm:m',
      powerLevels: { users: { '@gm:m': 50 }, events: { [EVENT_TYPES.WALL]: 50 } },
    });
    await sendStateEvent(sm, EVENT_TYPES.WALL, 'w1', {
      id: 'w1', map_id: 'm1', p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 },
    });
    expect(sm.widgetManager.sendStateEvent).toHaveBeenCalled();
  });

  it('passes through when no power_levels state has been ingested yet', async () => {
    const sm = makeSm({ userId: '@p:m', powerLevels: null });
    await sendStateEvent(sm, EVENT_TYPES.TOKEN, 't1', {
      id: 't1', map_id: 'm1', col: 0, row: 0, name: 'X', sheet_id: 'c1',
    });
    expect(sm.widgetManager.sendStateEvent).toHaveBeenCalled();
  });
});
