import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { YjsManager } from '../YjsManager.js';
import { YjsMatrixTransport } from '../../client/YjsMatrixTransport.js';
import { EVENT_TYPES } from '../../utils/constants.js';

describe('Distributed Sync Integration (Yjs + Matrix)', () => {
  let clientA, clientB;
  let transportA, transportB;
  let managerA, managerB;
  const roomId = '!room:id';

  beforeEach(() => {
    vi.useFakeTimers();

    // Setup Client A
    managerA = new YjsManager(roomId);
    clientA = {
      userId: '@alice:m.org',
      status: 'connected',
      sendVTTEvent: vi.fn().mockResolvedValue({}),
    };
    transportA = new YjsMatrixTransport(clientA, managerA, roomId);

    // Setup Client B
    managerB = new YjsManager(roomId);
    clientB = {
      userId: '@bob:m.org',
      status: 'connected',
      sendVTTEvent: vi.fn().mockResolvedValue({}),
    };
    transportB = new YjsMatrixTransport(clientB, managerB, roomId);

    // Mock network: wire sendVTTEvent calls to the other client's handleIncomingEvent
    const networkHandler = (senderTransport, receiverTransport) => async (rid, type, key, content) => {
      // Use a microtask to simulate async network delivery and avoid recursion issues
      await Promise.resolve();
      receiverTransport.handleIncomingEvent({ type, content, origin_server_ts: Date.now() });
      return {};
    };

    clientA.sendVTTEvent.mockImplementation(networkHandler(transportA, transportB));
    clientB.sendVTTEvent.mockImplementation(networkHandler(transportB, transportA));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    managerA.destroy();
    managerB.destroy();
    transportA.destroy();
    transportB.destroy();
  });

  it('syncs token movement between two clients', async () => {
    // Client A moves a token
    managerA.tokensMap.set('t1', { x: 10, y: 10 });
    
    // Wait for async network delivery
    await vi.advanceTimersByTimeAsync(300);

    // Verify Client B received it
    expect(managerB.tokens.get('t1').value).toEqual({ x: 10, y: 10 });
    
    // Client B moves same token
    managerB.tokensMap.set('t1', { x: 20, y: 20 });
    
    await vi.advanceTimersByTimeAsync(300);

    // Verify Client A received it
    expect(managerA.tokens.get('t1').value).toEqual({ x: 20, y: 20 });
  });

  it('handles chunked updates > 60KB', async () => {
    // Create a large drawing update. _MAX_CHUNK_SIZE is 24000 so a
    // 150 KB payload splits into 7 chunks: 150000 / 24000 = 6.25 → 7.
    const largeData = new Uint8Array(150000).fill(1);
    managerA.drawingsArray.push([largeData]);

    // Wait for all chunk sends
    await vi.advanceTimersByTimeAsync(300);

    // Verify A sent 7 chunks (150KB / 24KB = 6.25 -> 7 chunks).
    expect(clientA.sendVTTEvent).toHaveBeenCalledTimes(7);

    // Verify B reassembled and applied it
    expect(managerB.drawingsArray.get(0)).toEqual(largeData);
  });

  it('detects divergence via periodic sync vectors', async () => {
    const divergenceSpy = vi.spyOn(managerB, 'compareStateVector');
    
    // Advance time by 30s to trigger check
    await vi.advanceTimersByTimeAsync(31000);

    expect(clientA.sendVTTEvent).toHaveBeenCalledWith(
      roomId, 
      'com.matrixvtt.yjs.sync_vector', 
      null, 
      expect.any(Object)
    );
    expect(divergenceSpy).toHaveBeenCalled();
  });

  it('merges state correctly after a client reconnects', async () => {
    // 1. Client B goes offline
    clientB.status = 'disconnected';
    clientB.sendVTTEvent.mockClear();
    clientA.sendVTTEvent.mockImplementation(async () => ({})); // blackhole

    // 2. Client A makes changes
    managerA.tokensMap.set('reconnect-test', { status: 'A' });

    // 3. Client B makes changes offline
    managerB.tokensMap.set('reconnect-test', { status: 'B' });

    // 4. Client B reconnects and they exchange missing updates
    clientB.status = 'connected';
    
    // Manually trigger sync (in reality this happens via Matrix catch-up)
    const updateA = Y.encodeStateAsUpdate(managerA.doc);
    const updateB = Y.encodeStateAsUpdate(managerB.doc);

    await transportB.handleIncomingEvent({ 
      type: 'com.matrixvtt.yjs.update', 
      content: { seq: 'a1', idx: 0, total: 1, data: btoa(String.fromCharCode(...updateA)) } 
    });
    await transportA.handleIncomingEvent({ 
      type: 'com.matrixvtt.yjs.update', 
      content: { seq: 'b1', idx: 0, total: 1, data: btoa(String.fromCharCode(...updateB)) } 
    });

    // Wait for async reassembly
    await vi.advanceTimersByTimeAsync(300);

    // Verify convergence
    expect(managerA.tokens.get('reconnect-test').value).toEqual(managerB.tokens.get('reconnect-test').value);
  });

  it('handles late join post-snapshot correctly', async () => {
    // 1. Existing client A populates state
    managerA.tokensMap.set('t1', { x: 10 });
    managerA.tokensMap.set('t2', { x: 20 });
    
    // 2. Client A creates a snapshot
    const snapshot = Y.encodeStateAsUpdate(managerA.doc);
    const marker = Date.now();
    
    // 3. New client C joins
    const managerC = new YjsManager(roomId);
    const clientC = { userId: '@charlie:m.org', status: 'connected', sendVTTEvent: vi.fn().mockResolvedValue({}) };
    const transportC = new YjsMatrixTransport(clientC, managerC, roomId);

    // 4. Client C loads snapshot
    managerC.loadSnapshot(snapshot, marker);

    // 5. Client A makes a new post-snapshot update
    managerA.tokensMap.set('t1', { x: 100 });
    await vi.advanceTimersByTimeAsync(300);

    // Wire A -> C for the live update
    const updateCall = clientA.sendVTTEvent.mock.calls
      .filter(c => c[1] === 'com.matrixvtt.yjs.update')
      .pop();
    const updateContent = updateCall[3];
    
    transportC.handleIncomingEvent({ 
      type: 'com.matrixvtt.yjs.update', 
      content: updateContent, 
      origin_server_ts: Date.now() 
    });

    await vi.advanceTimersByTimeAsync(300);

    // Verify C has correct state
    expect(managerC.tokens.get('t1').value).toEqual({ x: 100 });
    expect(managerC.tokens.get('t2').value).toEqual({ x: 20 });
    
    managerC.destroy();
    transportC.destroy();
  });

  it('recovers from network partition + snapshot override', async () => {
    // 1. Initial sync
    managerA.tokensMap.set('base', 0);
    await vi.advanceTimersByTimeAsync(300);
    
    // 2. Client A goes offline
    clientA.status = 'disconnected';
    
    // 3. Client B performs snapshot and multiple updates
    managerB.tokensMap.set('b1', 1);
    const snapshot = Y.encodeStateAsUpdate(managerB.doc);
    const marker = Date.now() + 1000;
    managerB.loadSnapshot(snapshot, marker);
    managerB.tokensMap.set('b2', 2);
    
    // 4. Client A reconnects with stale state
    clientA.status = 'connected';
    
    // A receives B's snapshot first (as it should in a real room)
    managerA.loadSnapshot(snapshot, marker);
    
    // A receives B's post-snapshot update
    const updateB = Y.encodeStateAsUpdate(managerB.doc);
    await transportA.handleIncomingEvent({ 
      type: 'com.matrixvtt.yjs.update', 
      content: { seq: 'b-post', idx: 0, total: 1, data: btoa(String.fromCharCode(...updateB)) } 
    });

    await vi.advanceTimersByTimeAsync(300);

    // Verify A is overridden by B's snapshot branch
    expect(managerA.tokens.get('b1').value).toBe(1);
    expect(managerA.tokens.get('b2').value).toBe(2);
    expect(managerA.tokens.get('base').value).toBe(0);
  });

  // ─── Multi-type convergence (1.1b) ────────────────────────────────────────

  it('walls converge across two clients', async () => {
    managerA.wallsMap.set('w1', { id: 'w1', p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 } });
    await vi.advanceTimersByTimeAsync(300);
    expect(managerB.walls.get('w1').value).toMatchObject({ id: 'w1' });
  });

  it('concurrent fog reveals from two clients converge to the union', async () => {
    // A reveals one set of cells
    managerA.fogMap.set('', { mode: 'hidden', revealed: ['1,1', '2,2'] });
    await vi.advanceTimersByTimeAsync(300);
    // B then reveals more (post-sync, building on what they received)
    const bView = managerB.fog.get('').value;
    managerB.fogMap.set('', { mode: 'hidden', revealed: [...bView.revealed, '3,3', '4,4'] });
    await vi.advanceTimersByTimeAsync(300);
    expect(managerA.fog.get('').value.revealed.sort()).toEqual(['1,1', '2,2', '3,3', '4,4']);
  });

  it('initiative current_index advances converge under last-write-wins on the singleton key', async () => {
    managerA.initiativeMap.set('', { active: true, round: 1, current_index: 0, order: [{ token_id: 't1' }, { token_id: 't2' }] });
    await vi.advanceTimersByTimeAsync(300);
    managerB.initiativeMap.set('', { active: true, round: 1, current_index: 1, order: [{ token_id: 't1' }, { token_id: 't2' }] });
    await vi.advanceTimersByTimeAsync(300);
    expect(managerA.initiative.get('').value.current_index).toBe(1);
    expect(managerB.initiative.get('').value.current_index).toBe(1);
  });

  it('items converge - A creates, B updates the same key', async () => {
    managerA.itemsMap.set('i1', { id: 'i1', name: 'Sword', equipped: false });
    await vi.advanceTimersByTimeAsync(300);
    expect(managerB.items.get('i1').value.equipped).toBe(false);

    managerB.itemsMap.set('i1', { id: 'i1', name: 'Sword', equipped: true });
    await vi.advanceTimersByTimeAsync(300);
    expect(managerA.items.get('i1').value.equipped).toBe(true);
  });

  it('settings converge across clients (singleton)', async () => {
    managerA.settingsMap.set('', { gm_user_ids: ['@gm:m'], active_map_id: 'm1' });
    await vi.advanceTimersByTimeAsync(300);
    expect(managerB.settings.get('').value.active_map_id).toBe('m1');
  });

  it('templates converge - distinct keys from each side coexist', async () => {
    managerA.templatesMap.set('tA', { id: 'tA', shape: 'circle' });
    managerB.templatesMap.set('tB', { id: 'tB', shape: 'cone' });
    await vi.advanceTimersByTimeAsync(300);
    expect(managerA.templates.get('tB').value.shape).toBe('cone');
    expect(managerB.templates.get('tA').value.shape).toBe('circle');
  });
});
