/**
 * Multi-target damage - applyDamageToTokens
 *
 * When a Fireball hits multiple tokens, the GM should be able to apply
 * damage to all of them in one call rather than five separate dialogs.
 */

import { describe, it, expect, vi } from 'vitest';
import { applyDamageToTokens } from '../map/actions/combat.js';
import { VTT_EVENTS } from '../utils/constants.js';

function makeToken(id, hp_current, hp_max = 30) {
  return { id, name: `Token-${id}`, hp_current, hp_max };
}

function makeMr(tokens) {
  const tokenMap = new Map(tokens.map(t => [t.id, t]));
  const sendStateEvent = vi.fn().mockResolvedValue(undefined);
  const state = {
    tokens: tokenMap,
    sendStateEvent,
    widgetManager: { sendRoomEvent: vi.fn().mockResolvedValue(undefined) },
  };
  state.updateToken = async (id, t) => {
    tokenMap.set(id, t);
    return sendStateEvent('com.vtt.token', id, t);
  };
  return {
    state,
    selectedToken: null,
    render: vi.fn(),
  };
}

describe('applyDamageToTokens', () => {
  it('applies damage to all listed tokens', async () => {
    const mr = makeMr([makeToken('a', 30), makeToken('b', 20)]);
    await applyDamageToTokens(mr, ['a', 'b'], 10);
    expect(mr.state.tokens.get('a').hp_current).toBe(20);
    expect(mr.state.tokens.get('b').hp_current).toBe(10);
  });

  it('clamps HP to 0 on lethal damage', async () => {
    const mr = makeMr([makeToken('a', 5)]);
    await applyDamageToTokens(mr, ['a'], 20);
    expect(mr.state.tokens.get('a').hp_current).toBe(0);
  });

  it('calls sendStateEvent for each token', async () => {
    const mr = makeMr([makeToken('a', 30), makeToken('b', 30), makeToken('c', 30)]);
    await applyDamageToTokens(mr, ['a', 'b', 'c'], 5);
    expect(mr.state.sendStateEvent).toHaveBeenCalledTimes(3);
  });

  it('dispatches vtt:damage for each token', async () => {
    const mr = makeMr([makeToken('a', 20), makeToken('b', 15)]);
    const events = [];
    window.addEventListener(VTT_EVENTS.DAMAGE, e => events.push(e.detail), { once: false });
    await applyDamageToTokens(mr, ['a', 'b'], 5);
    expect(events.length).toBeGreaterThanOrEqual(2);
    window.removeEventListener(VTT_EVENTS.DAMAGE, () => {});
  });

  it('skips tokens that do not exist', async () => {
    const mr = makeMr([makeToken('a', 30)]);
    await applyDamageToTokens(mr, ['a', 'missing'], 10);
    expect(mr.state.sendStateEvent).toHaveBeenCalledTimes(1);
  });
});
