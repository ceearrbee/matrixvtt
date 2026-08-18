/**
 * The activity log is capped at MAX_LOG_ENTRIES; an unbounded
 * `_seenLogEventIds` dedup set is a slow memory leak across a long
 * session. Evicting a log entry must also prune its id from the set.
 */
import { describe, it, expect } from 'vitest';
import { log } from '../ui/log-panel.js';

const MAX = 2000;

function makeUi() {
  return /** @type {any} */ ({ activityLog: [], _seenLogEventIds: new Set() });
}

describe('log dedup-set pruning', () => {
  it('keeps _seenLogEventIds bounded in lock-step with the capped log', () => {
    const ui = makeUi();
    for (let i = 0; i <= MAX; i++) {
      log(ui, '💬', `<b>m</b>: ${i}`, { eventId: `e${i}` });
    }
    // Log capped at MAX; oldest entry (e0) evicted, newest (e<MAX>) retained.
    expect(ui.activityLog).toHaveLength(MAX);
    expect(ui._seenLogEventIds.size).toBeLessThanOrEqual(MAX);
    expect(ui._seenLogEventIds.has('e0')).toBe(false);      // pruned with its entry
    expect(ui._seenLogEventIds.has(`e${MAX}`)).toBe(true);  // still tracked
  });
});
