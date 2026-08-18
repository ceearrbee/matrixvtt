import { describe, it, expect, vi } from 'vitest';
import { getRoomState } from '../room-adapter.js';
import { EVENT_TYPES } from '../../utils/constants.js';

describe('getRoomState', () => {
  it('returns [] without a widgetApi', async () => {
    expect(await getRoomState({ widgetApi: null })).toEqual([]);
  });

  it('collects events across the receivable state types, mapped to the bridge shape', async () => {
    const receiveStateEvents = vi.fn(async (type) =>
      type === EVENT_TYPES.SETTINGS
        ? [{ type, state_key: '', content: { name: 'S' }, event_id: '$1', sender: '@gm:m' }]
        : []
    );
    const wm = { widgetApi: { receiveStateEvents }, roomId: '!r:m', _roomIdsSupported: null };

    const events = await getRoomState(wm);

    expect(events).toEqual([
      { type: EVENT_TYPES.SETTINGS, state_key: '', content: { name: 'S' }, event_id: '$1' },
    ]);
    expect(receiveStateEvents).toHaveBeenCalledWith(EVENT_TYPES.TOKEN, expect.anything());
  });
});
