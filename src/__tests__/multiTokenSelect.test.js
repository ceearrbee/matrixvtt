/**
 * Selecting, and moving, more than one token.
 *
 * Shift-click extends the selection, Escape clears it, and the arrow
 * keys move every selected token together. A token blocked by a wall
 * holds its ground while the rest of the group moves, because a group
 * move that fails wholesale on one blocked member is worse than one
 * that reports what happened.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { selectedTokenIdsSignal } from '../state/ui-signals.js';
import { moveSelectionBy } from '../map/actions/move-selection.js';

function makeMr(tokens, { blocked = [] } = {}) {
  const map = { width_cells: 20, height_cells: 20, cell_px: 40 };
  const store = new Map(tokens.map((t) => [t.id, { ...t }]));
  return /** @type {any} */ ({
    selectedToken: null,
    state: {
      map,
      tokens: store,
      canMoveToken: () => true,
      updateTokenPosition: vi.fn(async (id, col, row) => {
        if (blocked.includes(id)) throw new Error('Blocked by wall');
        store.set(id, { ...store.get(id), col, row });
      }),
    },
    render: vi.fn(),
    _toast: vi.fn(),
  });
}

beforeEach(() => { selectedTokenIdsSignal.value = new Set(); });

describe('moving a selection', () => {
  it('moves every selected token by the same delta', async () => {
    const mr = makeMr([{ id: 'a', col: 1, row: 1 }, { id: 'b', col: 5, row: 5 }]);
    await moveSelectionBy(mr, ['a', 'b'], 1, 0);
    expect(mr.state.updateTokenPosition).toHaveBeenCalledWith('a', 2, 1);
    expect(mr.state.updateTokenPosition).toHaveBeenCalledWith('b', 6, 5);
  });

  it('reports how many moved', async () => {
    const mr = makeMr([{ id: 'a', col: 1, row: 1 }, { id: 'b', col: 5, row: 5 }]);
    const result = await moveSelectionBy(mr, ['a', 'b'], 0, 1);
    expect(result).toEqual({ moved: 2, blocked: 0 });
  });

  it('moves the rest when one token is blocked by a wall', async () => {
    const mr = makeMr([{ id: 'a', col: 1, row: 1 }, { id: 'b', col: 5, row: 5 }], { blocked: ['a'] });
    const result = await moveSelectionBy(mr, ['a', 'b'], 1, 0);
    expect(result).toEqual({ moved: 1, blocked: 1 });
    expect(mr.state.tokens.get('b')).toMatchObject({ col: 6, row: 5 });
  });

  it('leaves a blocked token where it was', async () => {
    const mr = makeMr([{ id: 'a', col: 1, row: 1 }], { blocked: ['a'] });
    await moveSelectionBy(mr, ['a'], 1, 0);
    expect(mr.state.tokens.get('a')).toMatchObject({ col: 1, row: 1 });
  });

  it('skips a token the viewer may not move', async () => {
    const mr = makeMr([{ id: 'a', col: 1, row: 1 }]);
    mr.state.canMoveToken = () => false;
    const result = await moveSelectionBy(mr, ['a'], 1, 0);
    expect(result.moved).toBe(0);
    expect(mr.state.updateTokenPosition).not.toHaveBeenCalled();
  });

  it('does nothing with an empty selection', async () => {
    const mr = makeMr([{ id: 'a', col: 1, row: 1 }]);
    expect(await moveSelectionBy(mr, [], 1, 0)).toEqual({ moved: 0, blocked: 0 });
  });
});
