import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { inspectRoom, renderInspectorPanel } from '../standalone/room-inspector.js';

function makeClient(opts = {}) {
  return {
    userId: opts.userId ?? '@me:server',
    getRoomState: vi.fn().mockResolvedValue(opts.state ?? []),
    getRoomName: vi.fn().mockResolvedValue(opts.name ?? 'Test Room'),
    getJoinedRooms: vi.fn().mockResolvedValue(opts.joined ?? []),
    resolveRoomAlias: vi.fn().mockResolvedValue(opts.resolvedId ?? '!resolved:server'),
  };
}

describe('inspectRoom', () => {
  it('buckets events into live / ghost / non-VTT', async () => {
    const client = makeClient({
      state: [
        { type: 'com.vtt.settings', state_key: '', content: { gm_user_ids: ['@me:server'] } },
        { type: 'com.vtt.token', state_key: 'tok-1', content: { name: 'Goblin' } },
        { type: 'com.vtt.token', state_key: 'tok-2', content: {} }, // ghost
        { type: 'com.vtt.character', state_key: 'char-1', content: { name: 'Elara' } },
        { type: 'm.room.name', state_key: '', content: { name: 'Test' } },
        { type: 'm.room.member', state_key: '@me:server', content: { membership: 'join' } },
      ],
    });
    const r = await inspectRoom(client, '!abc:server');
    expect(r.summary.vttLive).toEqual({ 'com.vtt.settings': 1, 'com.vtt.token': 1, 'com.vtt.character': 1 });
    expect(r.summary.vttGhost).toEqual({ 'com.vtt.token': 1 });
    expect(r.summary.nonVtt).toEqual({ 'm.room.name': 1, 'm.room.member': 1 });
  });

  it('resolves aliases via resolveRoomAlias', async () => {
    const client = makeClient({ resolvedId: '!resolved:server', state: [] });
    const r = await inspectRoom(client, '#foo:server');
    expect(client.resolveRoomAlias).toHaveBeenCalledWith('#foo:server');
    expect(client.getRoomState).toHaveBeenCalledWith('!resolved:server');
    expect(r.roomId).toBe('!resolved:server');
  });

  it('passes room IDs through unchanged', async () => {
    const client = makeClient({ state: [] });
    const r = await inspectRoom(client, '!abc:server');
    expect(client.resolveRoomAlias).not.toHaveBeenCalled();
    expect(r.roomId).toBe('!abc:server');
  });

  it('flags isGM based on settings.gm_user_ids', async () => {
    const clientYes = makeClient({
      state: [{ type: 'com.vtt.settings', state_key: '', content: { gm_user_ids: ['@me:server'] } }],
    });
    const clientNo = makeClient({
      state: [{ type: 'com.vtt.settings', state_key: '', content: { gm_user_ids: ['@other:server'] } }],
    });
    expect((await inspectRoom(clientYes, '!a:b')).isGM).toBe(true);
    expect((await inspectRoom(clientNo, '!a:b')).isGM).toBe(false);
  });

  it('flags isJoined based on getJoinedRooms', async () => {
    const client = makeClient({ joined: ['!a:b', '!c:d'] });
    expect((await inspectRoom(client, '!a:b')).isJoined).toBe(true);
    expect((await inspectRoom(client, '!x:y')).isJoined).toBe(false);
  });

  it('collects foreign user-keyed events that would 403 on tombstone', async () => {
    const client = makeClient({
      userId: '@me:server',
      state: [
        { type: 'com.vtt.cursor', state_key: '@me:server', content: { x: 1 } },      // own - ignored
        { type: 'com.vtt.cursor', state_key: '@foreign:server', content: { x: 2 } }, // foreign
        { type: 'com.vtt.cursor', state_key: '@alt:server', content: { x: 3 } },    // foreign
        { type: 'com.vtt.token', state_key: 'tok-1', content: { name: 'x' } },       // not user-keyed
      ],
    });
    const r = await inspectRoom(client, '!a:b');
    expect(r.foreignCursors).toHaveLength(2);
    expect(r.foreignCursors.map(f => f.state_key).sort()).toEqual(['@alt:server', '@foreign:server']);
  });
});

describe('renderInspectorPanel', () => {
  let container;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  afterEach(() => { container.remove(); });

  it('mounts the form and wires the submit button', async () => {
    const app = { auth: { client: makeClient({ state: [] }) } };
    renderInspectorPanel(app, container);
    expect(container.querySelector('#inspect-room-input')).not.toBeNull();
    expect(container.querySelector('#inspect-btn')).not.toBeNull();
    expect(container.querySelector('#inspect-results')).not.toBeNull();
  });

  it('renders results on submit', async () => {
    const app = { auth: { client: makeClient({
      state: [{ type: 'com.vtt.token', state_key: 'tok-1', content: { name: 'Goblin' } }],
      name: 'My Room',
    }) } };
    renderInspectorPanel(app, container);
    container.querySelector('#inspect-room-input').value = '!abc:server';
    container.querySelector('#inspect-btn').click();
    await new Promise((r) => setTimeout(r, 10));
    const results = container.querySelector('#inspect-results');
    expect(results.textContent).toContain('My Room');
    expect(results.textContent).toContain('com.vtt.token');
  });

  it('surfaces errors via the error slot', async () => {
    const client = makeClient();
    client.getRoomState.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { errcode: 'M_FORBIDDEN' }));
    const app = { auth: { client } };
    renderInspectorPanel(app, container);
    container.querySelector('#inspect-room-input').value = '!abc:server';
    container.querySelector('#inspect-btn').click();
    await new Promise((r) => setTimeout(r, 10));
    const err = container.querySelector('#inspect-error');
    expect(err.classList.contains('visible')).toBe(true);
    expect(err.textContent).toContain('M_FORBIDDEN');
  });
});
