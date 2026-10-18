/**
 * Both room managers report the same room access (encryption and join
 * rule), so the shell and the encrypted-room refusal behave the same in
 * widget mode and standalone.
 */
import { describe, it, expect, vi } from 'vitest';
import { ClientManager } from '../client/ClientManager.js';
import { getRoomAccess as adapterGetRoomAccess } from '../widget/room-adapter.js';
import { buildCapabilities } from '../widget/capabilities.js';
import { EVENT_TYPES } from '../utils/constants.js';

const ENCRYPTION = { type: EVENT_TYPES.ROOM_ENCRYPTION, state_key: '', content: { algorithm: 'm.megolm.v1.aes-sha2' } };
const PUBLIC = { type: EVENT_TYPES.JOIN_RULES, state_key: '', content: { join_rule: 'public' } };

describe('ClientManager.getRoomAccess', () => {
  it('reads encryption and the join rule of its own room', async () => {
    const cm = Object.create(ClientManager.prototype);
    cm.roomId = '!r:hs';
    const getStateEventContent = vi.fn(async (_roomId, type) =>
      ({ [EVENT_TYPES.ROOM_ENCRYPTION]: ENCRYPTION.content, [EVENT_TYPES.JOIN_RULES]: PUBLIC.content })[type] ?? null);
    cm._client = { getStateEventContent };
    expect(await cm.getRoomAccess()).toEqual({ encrypted: true, joinRule: 'public' });
    expect(getStateEventContent).toHaveBeenCalledWith('!r:hs', EVENT_TYPES.ROOM_ENCRYPTION, '');
  });

  it('reports an unencrypted room with an unknown rule when nothing can be read', async () => {
    const cm = Object.create(ClientManager.prototype);
    cm.roomId = '!r:hs';
    cm._client = { getStateEventContent: vi.fn(async () => null) };
    expect(await cm.getRoomAccess()).toEqual({ encrypted: false, joinRule: null });
  });
});

describe('room-adapter getRoomAccess (widget mode)', () => {
  function makeWm(byType) {
    return {
      _roomIdsSupported: false,
      widgetApi: { receiveStateEvents: vi.fn(async (type) => byType[type] ?? []) },
    };
  }

  it('reads encryption and the join rule through the widget API', async () => {
    const wm = makeWm({ [EVENT_TYPES.ROOM_ENCRYPTION]: [ENCRYPTION], [EVENT_TYPES.JOIN_RULES]: [PUBLIC] });
    expect(await adapterGetRoomAccess(wm)).toEqual({ encrypted: true, joinRule: 'public' });
  });

  it('reports an unencrypted room with an unknown rule when nothing can be read', async () => {
    const wm = { widgetApi: { receiveStateEvents: vi.fn().mockRejectedValue(new Error('denied')) } };
    expect(await adapterGetRoomAccess(wm)).toEqual({ encrypted: false, joinRule: null });
  });
});

describe('widget capabilities cover room encryption', () => {
  it('can read m.room.encryption', () => {
    expect(buildCapabilities()).toContain(`org.matrix.msc2762.receive.state_event:${EVENT_TYPES.ROOM_ENCRYPTION}`);
  });
});
