/**
 * The queue banner count must aggregate per-source (matrix + yjs)
 * instead of letting the last event clobber the total.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { setupSyncListeners } from '../ui/lifecycle-init.js';
import { queueCountSignal } from '../state/ui-signals.js';
import { VTT_EVENTS } from '../utils/constants.js';

function makeUi() {
  return /** @type {any} */ ({
    widgetManager: { getApi: () => null },
    _updateSyncBanner: () => {},
    _refreshApiStatus: () => {},
  });
}

let ui;

function teardown() {
  if (!ui) return;
  window.removeEventListener(VTT_EVENTS.RATE_LIMITED, ui._onRateLimited);
  window.removeEventListener(VTT_EVENTS.QUEUE_PENDING, ui._onQueuePending);
  window.removeEventListener(VTT_EVENTS.QUEUE_EMPTY, ui._onQueueEmpty);
  window.removeEventListener(VTT_EVENTS.SYNC_ERROR, ui._onSyncError);
  window.removeEventListener(VTT_EVENTS.SYNC_RECOVERED, ui._onSyncRecovered);
  ui = null;
}

afterEach(teardown);

const pending = (count, source) =>
  window.dispatchEvent(new CustomEvent(VTT_EVENTS.QUEUE_PENDING, { detail: { count, source } }));
const empty = (source) =>
  window.dispatchEvent(new CustomEvent(VTT_EVENTS.QUEUE_EMPTY, { detail: { source } }));

describe('queue count aggregation', () => {
  it('sums counts across sources', () => {
    ui = makeUi();
    setupSyncListeners(ui);
    pending(3, 'matrix');
    pending(2, 'yjs');
    expect(queueCountSignal.value).toBe(5);
  });

  it('an empty event only zeroes its own source', () => {
    ui = makeUi();
    setupSyncListeners(ui);
    pending(3, 'matrix');
    pending(2, 'yjs');
    empty('yjs');
    expect(queueCountSignal.value).toBe(3);
    empty('matrix');
    expect(queueCountSignal.value).toBe(0);
  });
});
