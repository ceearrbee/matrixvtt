/**
 * Wrapper that intercepts every "I picked a room" click with a
 * preview modal: Cancel must NOT call enterRoom; Confirm must.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../standalone/session.js', () => ({
  enterRoom: vi.fn(async () => {}),
}));

import { confirmAndEnterRoom, showRoomPreview } from '../standalone/discovery/room-preview.js';
import { enterRoom } from '../standalone/session.js';

function makeApp(overrides = {}) {
  return {
    appLog: { add: vi.fn() },
    setError: vi.fn(),
    auth: {
      client: {
        getRoomName: vi.fn(async () => 'A Room'),
        getVttState: vi.fn(async () => null),
        getRoomState: vi.fn(async () => [
          { type: 'm.room.member', state_key: '@a:hs', content: { membership: 'join' } },
        ]),
        getRoomMembers: vi.fn(async () => []),
        resolveRoomAlias: vi.fn(),
      },
    },
    ...overrides,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  enterRoom.mockClear();
});

describe('confirmAndEnterRoom', () => {
  it('shows the preview modal and calls enterRoom on Confirm', async () => {
    const app = makeApp();
    await confirmAndEnterRoom(app, '!room:hs', 'A Room');

    const modal = document.getElementById('room-preview-modal');
    expect(modal).toBeTruthy();
    expect(modal.textContent).toContain('A Room');

    modal.querySelector('[data-confirm]').click();
    expect(enterRoom).toHaveBeenCalledWith(app, '!room:hs', 'A Room', false, []);
    expect(document.getElementById('room-preview-modal')).toBeNull();
  });

  it('does NOT call enterRoom on Cancel', async () => {
    const app = makeApp();
    await confirmAndEnterRoom(app, '!room:hs', 'A Room');
    document.getElementById('room-preview-modal').querySelector('[data-cancel]').click();
    expect(enterRoom).not.toHaveBeenCalled();
    expect(document.getElementById('room-preview-modal')).toBeNull();
  });

  it('hides the Confirm button when the room is not found', () => {
    showRoomPreview(
      { roomId: '#nope:hs', name: '#nope:hs', memberCount: 0, accessible: false, notFound: true, vtt: null, characters: [], npcs: [], joinRule: null },
      { onConfirm: vi.fn() },
    );
    const modal = document.getElementById('room-preview-modal');
    expect(modal.querySelector('[data-confirm]')).toBeNull();
    expect(modal.textContent).toContain('not found');
  });

  it('offers no join for an encrypted room and says why', () => {
    showRoomPreview(
      { roomId: '!e:hs', name: 'Secret', memberCount: 3, accessible: true, encrypted: true, vtt: null, characters: [], npcs: [], joinRule: 'invite' },
      { onConfirm: vi.fn() },
    );
    const modal = document.getElementById('room-preview-modal');
    expect(modal.querySelector('[data-confirm]')).toBeNull();
    expect(modal.textContent).toMatch(/does not support encrypted rooms/i);
  });

  it('says a public room can be read by anyone who joins', () => {
    showRoomPreview(
      { roomId: '!p:hs', name: 'Open Table', memberCount: 9, accessible: true, vtt: null, characters: [], npcs: [], joinRule: 'public' },
      { onConfirm: vi.fn() },
    );
    expect(document.getElementById('room-preview-modal').textContent).toMatch(/anyone can join and read/i);
  });

  it('says a room with no campaign opens as plain chat', () => {
    showRoomPreview(
      { roomId: '!c:hs', name: 'Chat', memberCount: 4, accessible: true, vtt: null, characters: [], npcs: [], joinRule: 'invite' },
      { onConfirm: vi.fn() },
    );
    const text = document.getElementById('room-preview-modal').textContent;
    expect(text).toMatch(/opens as plain chat/i);
    expect(text).not.toMatch(/setup wizard/i);
  });

  it('shows "Request to Join" label for knock-required rooms', () => {
    showRoomPreview(
      { roomId: '!r:hs', name: 'Knock Room', memberCount: 5, accessible: true, vtt: null, characters: [], npcs: [], joinRule: 'knock' },
      { onConfirm: vi.fn() },
    );
    const btn = document.querySelector('#room-preview-modal [data-confirm]');
    expect(btn.textContent).toBe('Request to Join');
  });
});
