/**
 * Right after createRoom, the matrix-js-sdk hasn't yet processed the
 * /sync that delivers the new room into its store, so sdk.getRoom()
 * returns null. canEditRoomState() must fall back to the SDK's
 * roomState() (GET /rooms/{id}/state) so the creator (PL 100) sees
 * the GM setup wizard instead of "Waiting for GM".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

function makeMocks({ sdkRoom, roomState }) {
  const mockClient = {
    start: vi.fn().mockResolvedValue({}),
    stop: vi.fn().mockResolvedValue({}),
    sendVTTEvent: vi.fn().mockResolvedValue({}),
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

describe('ClientManager.canEditRoomState - sync race fallback', () => {
  beforeEach(() => { vi.resetModules(); vi.restoreAllMocks(); });

  it('falls back to sdk.roomState and detects creator PL 100 when sdk has no room yet', async () => {
    const roomState = vi.fn().mockResolvedValue([
      {
        type: 'm.room.power_levels',
        state_key: '',
        content: { users: { '@me:m': 100 }, users_default: 0 },
      },
    ]);
    makeMocks({ sdkRoom: null, roomState });

    const { ClientManager } = await import('../ClientManager.js');
    const m = new ClientManager();
    m.setCredentials('https://m', 'tok', '@me:m', '!new:m');
    await m.init();

    expect(await m.canEditRoomState()).toBe(true);
    expect(roomState).toHaveBeenCalledOnce();
  });

  it('falls back to sdk.roomState and rejects a player without elevation', async () => {
    const roomState = vi.fn().mockResolvedValue([
      {
        type: 'm.room.power_levels',
        state_key: '',
        content: { users: { '@gm:m': 100 }, users_default: 0 },
      },
    ]);
    makeMocks({ sdkRoom: null, roomState });

    const { ClientManager } = await import('../ClientManager.js');
    const m = new ClientManager();
    m.setCredentials('https://m', 'tok', '@player:m', '!room:m');
    await m.init();

    expect(await m.canEditRoomState()).toBe(false);
  });

  it('uses sdk room data when available (no HTTP fallback)', async () => {
    const sdkRoom = {
      getMember: vi.fn().mockReturnValue({ powerLevel: 100 }),
    };
    const roomState = vi.fn();
    makeMocks({ sdkRoom, roomState });

    const { ClientManager } = await import('../ClientManager.js');
    const m = new ClientManager();
    m.setCredentials('https://m', 'tok', '@me:m', '!room:m');
    await m.init();

    expect(await m.canEditRoomState()).toBe(true);
    expect(roomState).not.toHaveBeenCalled();
  });

  it('getUserPowerLevel returns the raw level from sdk room data', async () => {
    const sdkRoom = { getMember: vi.fn().mockReturnValue({ powerLevel: 50 }) };
    makeMocks({ sdkRoom, roomState: vi.fn() });

    const { ClientManager } = await import('../ClientManager.js');
    const m = new ClientManager();
    m.setCredentials('https://m', 'tok', '@me:m', '!room:m');
    await m.init();

    expect(await m.getUserPowerLevel()).toBe(50);
  });

  it('getUserPowerLevel falls back to roomState and returns 0 on failure', async () => {
    const roomState = vi.fn().mockRejectedValue(new Error('403'));
    makeMocks({ sdkRoom: null, roomState });

    const { ClientManager } = await import('../ClientManager.js');
    const m = new ClientManager();
    m.setCredentials('https://m', 'tok', '@me:m', '!room:m');
    await m.init();

    expect(await m.getUserPowerLevel()).toBe(0);
  });
});
