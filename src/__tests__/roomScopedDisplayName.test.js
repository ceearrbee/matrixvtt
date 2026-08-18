/**
 * Display-name sync must be room-scoped (m.room.member for our own
 * user, merged over the existing event so avatar_url survives), never
 * the global /profile API, which renames the account in every room.
 */
import { describe, it, expect, vi } from 'vitest';
import { ClientManager } from '../client/ClientManager.js';
import { WidgetManager } from '../widget/WidgetManager.js';
import { setRoomDisplayName as adapterSetRoomDisplayName } from '../widget/room-adapter.js';

describe('ClientManager.setDisplayName', () => {
  it('writes the per-room member event, not the global profile', async () => {
    const setRoomDisplayName = vi.fn().mockResolvedValue(undefined);
    const setDisplayName = vi.fn();
    function FakeClient() {
      this.sdk = { setDisplayName };
      this.setRoomDisplayName = setRoomDisplayName;
    }
    const cm = new ClientManager({ matrixClientClass: /** @type {any} */ (FakeClient) });
    cm.setCredentials('https://hs.example', 'tok', '@me:hs.example', '!room:hs.example');
    await cm.setDisplayName('Aria (alice)');
    expect(setRoomDisplayName).toHaveBeenCalledWith('!room:hs.example', 'Aria (alice)');
    expect(setDisplayName).not.toHaveBeenCalled();
  });
});

describe('room-adapter setRoomDisplayName (widget mode)', () => {
  it('merges over the existing member event so avatar_url survives', async () => {
    const wm = {
      userId: '@me:hs.example',
      roomId: '!room:hs.example',
      widgetApi: {
        receiveStateEvents: vi.fn().mockResolvedValue([
          { state_key: '@other:hs', content: { membership: 'join', displayname: 'Other' } },
          { state_key: '@me:hs.example', content: { membership: 'join', displayname: 'Old', avatar_url: 'mxc://hs/abc' } },
        ]),
      },
      sendStateEvent: vi.fn().mockResolvedValue({}),
    };
    await adapterSetRoomDisplayName(wm, 'Aria (alice)');
    expect(wm.sendStateEvent).toHaveBeenCalledWith('m.room.member', '@me:hs.example', {
      membership: 'join',
      displayname: 'Aria (alice)',
      avatar_url: 'mxc://hs/abc',
    });
  });
});

describe('WidgetManager.setDisplayName', () => {
  it('routes through the room-scoped member write, not widgetApi.setDisplayName', async () => {
    const wm = new WidgetManager();
    wm.userId = '@me:hs.example';
    wm.roomId = '!room:hs.example';
    const globalSet = vi.fn();
    wm.widgetApi = {
      setDisplayName: globalSet,
      receiveStateEvents: vi.fn().mockResolvedValue([]),
    };
    wm.sendStateEvent = vi.fn().mockResolvedValue({});
    await wm.setDisplayName('GM (alice)');
    expect(globalSet).not.toHaveBeenCalled();
    expect(wm.sendStateEvent).toHaveBeenCalledWith('m.room.member', '@me:hs.example',
      expect.objectContaining({ membership: 'join', displayname: 'GM (alice)' }));
  });
});
