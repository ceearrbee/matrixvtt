/**
 * Differential sync repair: a peer whose sync_vector shows it is missing
 * local data gets sent exactly the diff it lacks, from exactly one
 * responder, without any snapshot reload.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { YjsManager, YJS_EVENT_TYPES } from '../YjsManager.js';
import { YjsMatrixTransport } from '../../client/YjsMatrixTransport.js';

const roomId = '!diff:test';
const b64 = (arr) => btoa(String.fromCharCode(...arr));

function updateSendCount(clients) {
  return clients.reduce(
    (n, c) => n + c.sendVTTEvent.mock.calls.filter(([, type]) => type === YJS_EVENT_TYPES.UPDATE).length,
    0,
  );
}

describe('differential sync repair', () => {
  let nodes; // { userId, manager, client, transport }
  let drops; // Set of `${from}->${to}` routes to blackhole

  function makeNode(userId) {
    const manager = new YjsManager(roomId);
    const client = { userId, status: 'connected', sendVTTEvent: vi.fn() };
    const transport = new YjsMatrixTransport(client, manager, roomId);
    const node = { userId, manager, client, transport };
    client.sendVTTEvent.mockImplementation(async (rid, type, key, content) => {
      await Promise.resolve();
      for (const other of nodes) {
        if (other === node) continue;
        if (drops.has(`${userId}->${other.userId}`)) continue;
        other.transport.handleIncomingEvent({
          type, content, sender: userId, origin_server_ts: Date.now(),
        });
      }
      return {};
    });
    return node;
  }

  function sendVector(from, to) {
    to.transport.handleIncomingEvent({
      type: YJS_EVENT_TYPES.SYNC_VECTOR,
      sender: from.userId,
      content: { vector: b64(from.manager.getStateVector()) },
      origin_server_ts: Date.now(),
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    nodes = [];
    drops = new Set();
  });

  afterEach(() => {
    for (const n of nodes) {
      n.transport.destroy();
      n.manager.destroy();
    }
    vi.useRealTimers();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('heals a dropped update via a diff, without any snapshot reload', async () => {
    const alice = makeNode('@alice:m.org');
    const bob = makeNode('@bob:m.org');
    nodes.push(alice, bob);
    const loadSpy = vi.spyOn(bob.manager, 'loadSnapshot');

    drops.add('@alice:m.org->@bob:m.org');
    alice.manager.tokensMap.set('t1', { x: 10 });
    await vi.advanceTimersByTimeAsync(300);
    expect(bob.manager.tokensMap.get('t1')).toBeUndefined();
    drops.clear();

    sendVector(bob, alice);
    await vi.advanceTimersByTimeAsync(1000);

    expect(bob.manager.tokensMap.get('t1')).toEqual({ x: 10 });
    expect(loadSpy).not.toHaveBeenCalled();
  });

  it('converges two peers that each dropped the other\'s update', async () => {
    const alice = makeNode('@alice:m.org');
    const bob = makeNode('@bob:m.org');
    nodes.push(alice, bob);

    drops.add('@alice:m.org->@bob:m.org');
    drops.add('@bob:m.org->@alice:m.org');
    alice.manager.tokensMap.set('tA', { x: 1 });
    bob.manager.tokensMap.set('tB', { x: 2 });
    await vi.advanceTimersByTimeAsync(300);
    drops.clear();

    sendVector(bob, alice);
    sendVector(alice, bob);
    await vi.advanceTimersByTimeAsync(1000);

    for (const n of [alice, bob]) {
      expect(n.manager.tokensMap.get('tA')).toEqual({ x: 1 });
      expect(n.manager.tokensMap.get('tB')).toEqual({ x: 2 });
    }
  });

  it('elects a single responder among caught-up peers', async () => {
    const alice = makeNode('@alice:m.org');
    const bob = makeNode('@bob:m.org');
    const carol = makeNode('@carol:m.org');
    const dave = makeNode('@dave:m.org');
    nodes.push(alice, bob, carol, dave);

    drops.add('@alice:m.org->@carol:m.org');
    alice.manager.tokensMap.set('t1', { x: 1 });
    await vi.advanceTimersByTimeAsync(300);
    drops.clear();
    expect(carol.manager.tokensMap.get('t1')).toBeUndefined();

    // Warm the rosters: the caught-up peers know about each other.
    for (const from of [alice, bob, dave]) {
      for (const to of [alice, bob, dave]) {
        if (from !== to) sendVector(from, to);
      }
    }

    const before = updateSendCount([alice.client, bob.client, carol.client, dave.client]);
    for (const to of [alice, bob, dave]) sendVector(carol, to);
    await vi.advanceTimersByTimeAsync(1000);

    const after = updateSendCount([alice.client, bob.client, carol.client, dave.client]);
    expect(after - before).toBe(1);
    expect(carol.manager.tokensMap.get('t1')).toEqual({ x: 1 });
  });

  it('does not re-answer the same lagging vector within the debounce window', async () => {
    const alice = makeNode('@alice:m.org');
    const bob = makeNode('@bob:m.org');
    nodes.push(alice, bob);

    drops.add('@alice:m.org->@bob:m.org');
    alice.manager.tokensMap.set('t1', { x: 1 });
    await vi.advanceTimersByTimeAsync(300);
    drops.add('@alice:m.org->@bob:m.org'); // keep bob lagging: drop the diff too

    const before = updateSendCount([alice.client]);
    sendVector(bob, alice);
    await vi.advanceTimersByTimeAsync(100);
    sendVector(bob, alice);
    await vi.advanceTimersByTimeAsync(5000);

    expect(updateSendCount([alice.client]) - before).toBe(1);
  });

  it('skips oversized diffs and invokes the snapshot fallback hook', async () => {
    const alice = makeNode('@alice:m.org');
    const bob = makeNode('@bob:m.org');
    nodes.push(alice, bob);

    drops.add('@alice:m.org->@bob:m.org');
    alice.manager.tokensMap.set('t1', { x: 1 });
    await vi.advanceTimersByTimeAsync(300);
    drops.clear();

    alice.transport._diffSizeCapBytes = 4;
    const hook = vi.fn();
    alice.transport.onOversizedDiff = hook;

    const before = updateSendCount([alice.client]);
    sendVector(bob, alice);
    await vi.advanceTimersByTimeAsync(1000);

    expect(updateSendCount([alice.client]) - before).toBe(0);
    expect(hook).toHaveBeenCalledTimes(1);
  });

  it('ignores its own sync_vector loopback', async () => {
    const alice = makeNode('@alice:m.org');
    const bob = makeNode('@bob:m.org');
    nodes.push(alice, bob);

    alice.manager.tokensMap.set('t1', { x: 1 });
    await vi.advanceTimersByTimeAsync(300);

    const laggard = new YjsManager(roomId);
    const laggingVector = b64(laggard.getStateVector());
    laggard.destroy();

    const before = updateSendCount([alice.client]);
    alice.transport.handleIncomingEvent({
      type: YJS_EVENT_TYPES.SYNC_VECTOR,
      sender: '@alice:m.org',
      content: { vector: laggingVector },
      origin_server_ts: Date.now(),
    });
    await vi.advanceTimersByTimeAsync(1000);

    expect(updateSendCount([alice.client]) - before).toBe(0);
  });
});
