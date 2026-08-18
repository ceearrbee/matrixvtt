/**
 * enableTokenDrag is called for every visible token on every tokens-layer
 * sync, which happens once per frame while a token is being dragged. If
 * each call tore down and re-added five Konva listeners per token, a
 * 30-token map would pay 150 listener rebuilds per frame. These tests lock
 * in that repeat calls with an unchanged (tokenId, canMove) pair are no-ops.
 */

import { describe, it, expect, vi } from 'vitest';
import { enableTokenDrag } from '../map/input/token-drag.js';

function makeGroup() {
  return {
    off: vi.fn(),
    on: vi.fn(),
    draggable: vi.fn(),
    x: () => 0,
    y: () => 0,
  };
}

function makeRenderer(canMove = true) {
  return {
    state: {
      map: { cell_px: 40, width_cells: 20, height_cells: 20 },
      tokens: new Map([['t1', { id: 't1', col: 0, row: 0, size: 1 }]]),
      canMoveToken: () => canMove,
      updateTokenPosition: vi.fn(() => Promise.resolve()),
    },
    render: vi.fn(),
    requestDragFrame: vi.fn(),
  };
}

describe('enableTokenDrag rebinding', () => {
  it('binds listeners once across repeated syncs for the same token', () => {
    const group = makeGroup();
    const mr = makeRenderer();

    enableTokenDrag(group, mr, 't1');
    const offCalls = group.off.mock.calls.length;
    const onCalls = group.on.mock.calls.length;
    expect(onCalls).toBeGreaterThan(0);

    enableTokenDrag(group, mr, 't1');
    enableTokenDrag(group, mr, 't1');

    expect(group.off.mock.calls.length).toBe(offCalls);
    expect(group.on.mock.calls.length).toBe(onCalls);
  });

  it('re-binds when the viewer gains permission to move the token', () => {
    const group = makeGroup();
    let canMove = false;
    const mr = makeRenderer();
    mr.state.canMoveToken = () => canMove;

    enableTokenDrag(group, mr, 't1');
    const onCalls = group.on.mock.calls.length;

    canMove = true;
    enableTokenDrag(group, mr, 't1');

    expect(group.on.mock.calls.length).toBeGreaterThan(onCalls);
    expect(group.draggable).toHaveBeenLastCalledWith(true);
  });

  it('re-binds when a recycled group is handed a different token id', () => {
    const group = makeGroup();
    const mr = makeRenderer();
    mr.state.tokens.set('t2', { id: 't2', col: 1, row: 1, size: 1 });

    enableTokenDrag(group, mr, 't1');
    const onCalls = group.on.mock.calls.length;

    enableTokenDrag(group, mr, 't2');

    expect(group.on.mock.calls.length).toBeGreaterThan(onCalls);
  });

  it('drag moves request a scoped drag frame, not a full render', () => {
    const group = makeGroup();
    const mr = makeRenderer();
    group.x = () => 200;
    group.y = () => 200;

    enableTokenDrag(group, mr, 't1');
    const dragmove = group.on.mock.calls.find(([ev]) => ev.startsWith('dragmove'))[1];
    dragmove();

    expect(mr.requestDragFrame).toHaveBeenCalled();
    expect(mr.render).not.toHaveBeenCalled();
  });
});
