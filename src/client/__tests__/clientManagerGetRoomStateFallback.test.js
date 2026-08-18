/**
 * ClientManager.getRoomState falls back to sdk.roomState (the SDK's
 * GET /rooms/{id}/state) when sdk.getRoom returns null because /sync
 * hasn't yet delivered the room. Caller for verifyInitialSave and
 * _fetchStaleVttEvents in the wizard flow.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

function makeMocks({ sdkRoom, roomState }) {
  const mockClient = {
    start: vi.fn().mockResolvedValue({}),
    stop: vi.fn().mockResolvedValue({}),
    sdk: {
      getCapabilities: vi.fn().mockResolvedValue({}),
      getRoom: vi.fn().mockReturnValue(sdkRoom),
      roomState: roomState ?? vi.fn(),
    },
  };
  vi.doMock('../MatrixClient.js', () => ({
    MatrixClient: class { constructor() { Object.assign(this, mockClient); } },
  }));
  vi.doMock('../MatrixApiAdapter.js', () => ({
    MatrixApiAdapter: class { stopSync() {} },
  }));
  return mockClient;
}

describe('ClientManager.getRoomState - sync race fallback', () => {
  beforeEach(() => { vi.resetModules(); vi.restoreAllMocks(); });

  it('returns sdk.roomState() result when sdk has no room yet', async () => {
    const events = [
      { type: 'com.vtt.token', state_key: 't1', content: { name: 'Aria' } },
      { type: 'm.room.power_levels', state_key: '', content: { users_default: 0 } },
    ];
    const roomState = vi.fn().mockResolvedValue(events);
    makeMocks({ sdkRoom: null, roomState });

    const { ClientManager } = await import('../ClientManager.js');
    const m = new ClientManager();
    m.setCredentials('https://m', 'tok', '@me:m', '!new:m');
    await m.init();

    const result = await m.getRoomState();
    expect(result).toBe(events);
    expect(roomState).toHaveBeenCalledWith('!new:m');
  });

  it('uses cached SDK room when available (no HTTP fallback)', async () => {
    const sdkRoom = {
      currentState: {
        getStateEvents: vi.fn().mockReturnValue([
          { getType: () => 'com.vtt.token', getStateKey: () => 't1', getContent: () => ({ name: 'Aria' }), getId: () => '$evt' },
        ]),
      },
    };
    const roomState = vi.fn();
    makeMocks({ sdkRoom, roomState });

    const { ClientManager } = await import('../ClientManager.js');
    const m = new ClientManager();
    m.setCredentials('https://m', 'tok', '@me:m', '!room:m');
    await m.init();

    const result = await m.getRoomState();
    expect(result).toEqual([
      { type: 'com.vtt.token', state_key: 't1', content: { name: 'Aria' }, event_id: '$evt' },
    ]);
    expect(roomState).not.toHaveBeenCalled();
  });
});
