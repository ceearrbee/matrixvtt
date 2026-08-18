/**
 * Combat Logic Unit Tests
 *
 * Tests the initiative action-economy reset (nextTurn) and index-adjustment
 * logic (removeFromInitiative) without requiring a full DOM / UIController setup.
 *
 * The functions are extracted as pure helpers and tested directly.
 */

import { describe, it, expect } from 'vitest';

// ─── Pure-logic extracts mirroring UIController methods ───────────────────────

/**
 * Mirrors the action-economy reset in UIController.nextTurn().
 * Returns the mutated initiative state (same object).
 */
function nextTurn(initiative) {
  const { order, current_index, round } = initiative;
  if (!order.length) return initiative;

  let newIndex = current_index + 1;
  let newRound = round;

  if (newIndex >= order.length) {
    newIndex = 0;
    newRound++;
  }

  initiative.current_index = newIndex;
  initiative.round = newRound;

  const incoming = order[newIndex];
  if (incoming) {
    incoming.action_used = false;
    incoming.bonus_action_used = false;
    incoming.reaction_used = false;
  }

  return initiative;
}

/**
 * Mirrors the index-adjustment logic in UIController.removeFromInitiative().
 * Returns the mutated initiative state.
 */
function removeFromInitiative(initiative, tokenId) {
  const { order, current_index } = initiative;
  const idx = order.findIndex(e => e.token_id === tokenId);
  if (idx === -1) return initiative;

  order.splice(idx, 1);

  let newIndex = current_index;
  if (idx < current_index) {
    newIndex = Math.max(0, current_index - 1);
  } else if (idx === current_index) {
    newIndex = order.length > 0 ? current_index % order.length : 0;
  }
  initiative.current_index = newIndex;

  if (order.length === 0) {
    initiative.active = false;
    initiative.round = 0;
    initiative.current_index = 0;
  }

  return initiative;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(id, tokenId, overrides = {}) {
  return { id, token_id: tokenId, name: id, initiative: 10, character_id: id, ...overrides };
}

function makeInitiative(entries, current_index = 0, round = 1) {
  return { active: true, order: entries, current_index, round };
}

// ─── nextTurn - action economy reset ─────────────────────────────────────────

describe('nextTurn - action economy reset', () => {
  it('clears action_used on the incoming combatant', () => {
    const a = makeEntry('a', 'tok-a', { action_used: false, bonus_action_used: false, reaction_used: false });
    const b = makeEntry('b', 'tok-b', { action_used: true, bonus_action_used: true, reaction_used: true });
    const init = makeInitiative([a, b], 0);

    nextTurn(init);

    expect(init.current_index).toBe(1);
    expect(b.action_used).toBe(false);
    expect(b.bonus_action_used).toBe(false);
    expect(b.reaction_used).toBe(false);
  });

  it('wraps to index 0 and increments the round', () => {
    const a = makeEntry('a', 'tok-a');
    const b = makeEntry('b', 'tok-b');
    const init = makeInitiative([a, b], 1, 2);

    nextTurn(init);

    expect(init.current_index).toBe(0);
    expect(init.round).toBe(3);
  });

  it('does not clear actions on the previous combatant', () => {
    const a = makeEntry('a', 'tok-a', { action_used: true });
    const b = makeEntry('b', 'tok-b');
    const init = makeInitiative([a, b], 0);

    nextTurn(init);

    expect(a.action_used).toBe(true); // unchanged - we only reset the incoming
  });

  it('is a no-op when order is empty', () => {
    const init = makeInitiative([], 0, 1);
    nextTurn(init);
    expect(init.current_index).toBe(0);
    expect(init.round).toBe(1);
  });
});

// ─── removeFromInitiative - current_index adjustment ─────────────────────────

describe('removeFromInitiative - current_index adjustment', () => {
  it('removing an entry AFTER current leaves current_index unchanged', () => {
    const entries = [makeEntry('a', 'tok-a'), makeEntry('b', 'tok-b'), makeEntry('c', 'tok-c')];
    const init = makeInitiative(entries, 0);

    removeFromInitiative(init, 'tok-c'); // remove index 2

    expect(init.order.length).toBe(2);
    expect(init.current_index).toBe(0);
    expect(init.order[0].token_id).toBe('tok-a');
  });

  it('removing an entry BEFORE current decrements current_index', () => {
    const entries = [makeEntry('a', 'tok-a'), makeEntry('b', 'tok-b'), makeEntry('c', 'tok-c')];
    const init = makeInitiative(entries, 2);

    removeFromInitiative(init, 'tok-a'); // remove index 0

    expect(init.current_index).toBe(1); // was 2, now 1
    expect(init.order[1].token_id).toBe('tok-c');
  });

  it('removing the CURRENT entry wraps index within bounds', () => {
    const entries = [makeEntry('a', 'tok-a'), makeEntry('b', 'tok-b'), makeEntry('c', 'tok-c')];
    const init = makeInitiative(entries, 2); // last entry is current

    removeFromInitiative(init, 'tok-c');

    expect(init.order.length).toBe(2);
    expect(init.current_index).toBe(0); // 2 % 2 = 0
  });

  it('removing the only entry deactivates combat', () => {
    const entries = [makeEntry('a', 'tok-a')];
    const init = makeInitiative(entries, 0);

    removeFromInitiative(init, 'tok-a');

    expect(init.order.length).toBe(0);
    expect(init.active).toBe(false);
    expect(init.current_index).toBe(0);
  });

  it('returns unchanged initiative when token_id not found', () => {
    const entries = [makeEntry('a', 'tok-a')];
    const init = makeInitiative(entries, 0);

    removeFromInitiative(init, 'tok-nonexistent');

    expect(init.order.length).toBe(1);
    expect(init.current_index).toBe(0);
  });
});
