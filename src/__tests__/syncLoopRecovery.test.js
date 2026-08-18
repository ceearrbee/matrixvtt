/**
 * MatrixApiAdapter - extended sync failure signalling
 *
 * After 10 consecutive sync errors the adapter dispatches vtt:sync-dead
 * so the UI can surface a "Reconnect" prompt. A subsequent successful
 * sync resets the counter and dispatches vtt:sync-recovered.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MatrixApiAdapter } from '../client/MatrixApiAdapter.js';
import { VTT_EVENTS } from '../utils/constants.js';

function makeAdapter() {
  const client = {
    getRoomState: vi.fn().mockResolvedValue([]),
    sync: vi.fn(),
    getRoomMessages: vi.fn().mockResolvedValue({ chunk: [], end: null }),
  };
  return new MatrixApiAdapter(client, '!room:example.com');
}

function collectEvents(name) {
  const events = [];
  const handler = () => events.push(true);
  window.addEventListener(name, handler);
  return { events, cleanup: () => window.removeEventListener(name, handler) };
}

describe('MatrixApiAdapter - consecutive failure tracking', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('dispatches vtt:sync-dead on the 10th consecutive failure', () => {
    const adapter = makeAdapter();
    const dead = collectEvents(VTT_EVENTS.SYNC_DEAD);

    for (let i = 0; i < 10; i++) adapter._recordSyncFailure();

    dead.cleanup();
    expect(dead.events.length).toBe(1);
  });

  it('dispatches vtt:sync-dead exactly once per 10-failure run', () => {
    const adapter = makeAdapter();
    const dead = collectEvents(VTT_EVENTS.SYNC_DEAD);

    for (let i = 0; i < 25; i++) adapter._recordSyncFailure();

    dead.cleanup();
    // Fires once at failure #10, then again at #20 - two runs of 10
    expect(dead.events.length).toBe(2);
  });

  it('does not dispatch vtt:sync-dead before 10 failures', () => {
    const adapter = makeAdapter();
    const dead = collectEvents(VTT_EVENTS.SYNC_DEAD);

    for (let i = 0; i < 9; i++) adapter._recordSyncFailure();

    dead.cleanup();
    expect(dead.events.length).toBe(0);
  });

  it('dispatches vtt:sync-recovered and resets the counter on success', () => {
    const adapter = makeAdapter();
    const recovered = collectEvents(VTT_EVENTS.SYNC_RECOVERED);

    // Force into dead state first
    for (let i = 0; i < 10; i++) adapter._recordSyncFailure();
    adapter._syncErrored = true;

    adapter._recordSyncSuccess();

    recovered.cleanup();
    expect(recovered.events.length).toBe(1);
    expect(adapter._consecutiveFailures).toBe(0);
  });

  it('dispatches vtt:sync-recovered once on the first successful sync', () => {
    const adapter = makeAdapter();
    const recovered = collectEvents(VTT_EVENTS.SYNC_RECOVERED);

    // First success - UI needs this to flip its optimistic-false badge to "Live"
    adapter._recordSyncSuccess();
    // Subsequent successes with no errors in between should not re-fire
    adapter._recordSyncSuccess();

    recovered.cleanup();
    expect(recovered.events.length).toBe(1);
  });

  it('isSyncHealthy reflects the sync state machine', () => {
    const adapter = makeAdapter();
    expect(adapter.isSyncHealthy()).toBe(false); // nothing synced yet

    adapter._recordSyncSuccess();
    expect(adapter.isSyncHealthy()).toBe(true);

    adapter._recordSyncFailure();
    adapter._syncErrored = true;
    expect(adapter.isSyncHealthy()).toBe(false);

    adapter._recordSyncSuccess();
    expect(adapter.isSyncHealthy()).toBe(true);
  });

  it('treats SYNCING after an ERROR as recovery (PREPARED only fires once per client)', () => {
    const sdkHandlers = {};
    const client = {
      sdk: { on: (name, fn) => { sdkHandlers[name] = fn; }, removeListener: () => {} },
      getRoomState: vi.fn().mockResolvedValue([]),
    };
    const adapter = new MatrixApiAdapter(client, '!room:example.com');
    const recovered = collectEvents(VTT_EVENTS.SYNC_RECOVERED);

    sdkHandlers['sync']('PREPARED');   // initial sync
    sdkHandlers['sync']('ERROR');      // transient failure
    sdkHandlers['sync']('SYNCING');    // js-sdk resumes with SYNCING, not PREPARED

    recovered.cleanup();
    expect(recovered.events.length).toBe(2); // initial + post-error recovery
    expect(adapter.isSyncHealthy()).toBe(true);
  });
});

describe('seedSyncOk - late-mounting UI pulls current sync health', () => {
  it('seeds syncOkSignal from the api instead of assuming false', async () => {
    const { seedSyncOk } = await import('../ui/lifecycle-init.js');
    const { syncOkSignal } = await import('../state/ui-signals.js');

    // The client reached PREPARED while the user was still on the
    // discovery screen - the one-shot SYNC_RECOVERED event is long gone
    // by the time the VTT UI mounts and registers listeners.
    seedSyncOk({ widgetManager: { getApi: () => ({ isSyncHealthy: () => true }) } });
    expect(syncOkSignal.value).toBe(true);

    seedSyncOk({ widgetManager: { getApi: () => ({ isSyncHealthy: () => false }) } });
    expect(syncOkSignal.value).toBe(false);

    seedSyncOk({ widgetManager: { getApi: () => ({}) } }); // api lacks the probe
    expect(syncOkSignal.value).toBe(false);
  });
});
