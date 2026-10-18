/**
 * The room list says which rooms MatrixVTT cannot open (encrypted) and
 * which ones anyone can join and read (public), in words as well as
 * styling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderActiveList, renderRecentList } from '../standalone/DiscoveryCards.jsx';
import { scanRooms } from '../standalone/discovery/scan.js';

const handlers = { join: vi.fn(), leave: vi.fn(), resume: vi.fn(), remove: vi.fn() };

let container;
beforeEach(() => {
  document.body.innerHTML = '<div id="list"></div>';
  container = document.getElementById('list');
});

describe('room cards', () => {
  it('an encrypted room offers no Join and says it cannot be opened', () => {
    renderActiveList(container, [
      { id: '!e:hs', name: 'Secret', vttState: null, access: { encrypted: true, joinRule: 'invite' } },
    ], handlers);
    expect(container.querySelector('.room-join')).toBeNull();
    expect(container.textContent).toMatch(/encrypted/i);
    expect(container.querySelector('.room-leave')).not.toBeNull();
  });

  it('a public room is labelled as public', () => {
    renderActiveList(container, [
      { id: '!p:hs', name: 'Open Table', vttState: null, access: { encrypted: false, joinRule: 'public' } },
    ], handlers);
    expect(container.textContent).toMatch(/public room/i);
    expect(container.querySelector('.room-join')).not.toBeNull();
  });

  it('a recent encrypted room cannot be resumed', () => {
    renderRecentList(container, [
      { userId: '@me:hs', roomId: '!e:hs', roomName: 'Secret', lastUsed: Date.now(), access: { encrypted: true, joinRule: 'invite' } },
    ], handlers);
    expect(container.querySelector('.recent-resume')).toBeNull();
    expect(container.textContent).toMatch(/encrypted/i);
  });
});

describe('scanRooms', () => {
  it('reads each room’s access alongside its name and campaign', async () => {
    const client = {
      getRoomName: vi.fn(async () => 'Secret'),
      getVttState: vi.fn(async () => null),
      getStateEventContent: vi.fn(async (_roomId, type) => ({
        'm.room.encryption': { algorithm: 'm.megolm.v1.aes-sha2' },
        'm.room.join_rules': { join_rule: 'invite' },
      })[type] ?? null),
    };
    const [result] = await scanRooms({ scanCancelled: false }, client, ['!e:hs']);
    expect(result.access).toEqual({ encrypted: true, joinRule: 'invite' });
  });
});
