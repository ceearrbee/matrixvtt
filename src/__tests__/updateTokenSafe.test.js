/**
 * updateTokenSafe - shared helper for token updates with error emission.
 *
 * combat.js and tokens.js both need to call state.updateToken, catch failures,
 * and emit a VTT_EVENTS.ERROR event without letting the error bubble. The
 * helper lives in map/actions/tokens.js; this test pins its contract so
 * combat.js can rely on the boolean return value to decide whether to dispatch
 * follow-up events (damage taken, healed, etc.).
 */

import { describe, it, expect, vi } from 'vitest';
import { updateTokenSafe } from '../map/actions/tokens.js';
import { VTT_EVENTS } from '../utils/constants.js';

function mrWith(updateTokenImpl) {
  return {
    state: { updateToken: updateTokenImpl },
  };
}

describe('updateTokenSafe', () => {
  it('resolves to true on success and calls updateToken with the payload', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const mr = mrWith(update);

    const result = await updateTokenSafe(mr, 'tok-1', { hp_current: 5 }, 'fail-msg');

    expect(result).toBe(true);
    expect(update).toHaveBeenCalledWith('tok-1', { hp_current: 5 });
  });

  it('resolves to false and emits VTT_EVENTS.ERROR on failure', async () => {
    const err = new Error('network down');
    const update = vi.fn().mockRejectedValue(err);
    const mr = mrWith(update);

    const events = [];
    const listener = (e) => events.push(e.detail);
    window.addEventListener(VTT_EVENTS.ERROR, listener);

    const result = await updateTokenSafe(mr, 'tok-1', { hp_current: 5 }, 'Failed to update');

    window.removeEventListener(VTT_EVENTS.ERROR, listener);
    expect(result).toBe(false);
    expect(events).toHaveLength(1);
    expect(events[0].message).toBe('Failed to update');
    expect(events[0].error).toBe(err);
  });
});
