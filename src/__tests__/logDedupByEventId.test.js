/**
 * log() must dedupe by Matrix event_id.
 *
 * Bug shape: send "rawr" as "Speak as Orc Guard". Local echo logged
 * "Orc Guard: rawr". A second entry "crb: rawr" then appeared - the
 * sync echo (or historical replay) re-logged the same Matrix event
 * via a different code path. The two log() callers don't coordinate,
 * so dedup has to live inside log() itself, keyed off opts.eventId
 * and ui._seenLogEventIds.
 *
 * Synthetic entries (dice, combat, etc.) carry no eventId and are
 * never deduped against each other.
 */
import { describe, it, expect } from 'vitest';
import { log } from '../ui/log-panel.js';

function makeUi() {
  return {
    activityLog: [],
    _seenLogEventIds: new Set(),
  };
}

describe('log() - event_id dedup', () => {
  it('two logs with the same eventId only insert once', () => {
    const ui = makeUi();
    log(ui, '💬', '<b>Orc Guard</b>: rawr', { eventId: 'evt-1', sender: '@crb:m.org' });
    log(ui, '💬', '<b>crb</b>: rawr',       { eventId: 'evt-1', sender: '@crb:m.org' });
    expect(ui.activityLog).toHaveLength(1);
    expect(ui.activityLog[0].html).toMatch(/Orc Guard/);
  });

  it('different eventIds insert both', () => {
    const ui = makeUi();
    log(ui, '💬', '<b>A</b>: hi', { eventId: 'evt-1' });
    log(ui, '💬', '<b>B</b>: hi', { eventId: 'evt-2' });
    expect(ui.activityLog).toHaveLength(2);
  });

  it('synthetic entries without eventId never collide', () => {
    const ui = makeUi();
    log(ui, '🎲', 'rolled 1d20 → 15');
    log(ui, '🎲', 'rolled 1d20 → 15');
    log(ui, '⚔️', 'attacked');
    expect(ui.activityLog).toHaveLength(3);
  });

  it('an entry with eventId does not block a later entry without one', () => {
    const ui = makeUi();
    log(ui, '💬', 'msg', { eventId: 'evt-1' });
    log(ui, '🎲', 'roll'); // no eventId - must still go through
    expect(ui.activityLog).toHaveLength(2);
  });
});
