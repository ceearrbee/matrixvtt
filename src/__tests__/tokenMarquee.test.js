/**
 * Dragging a box on empty ground selects the tokens it covers. The
 * rectangle is the one fog reveal/hide already sweeps, given a third
 * mode; the geometry that decides which tokens it caught is pure so it
 * can be checked without Konva.
 */
import { describe, it, expect, vi } from 'vitest';
import { tokensInRect, marqueeColors } from '../map/token-marquee.js';
import {
  startAreaSelection, beginSelectMarquee, completeAreaSelection,
} from '../map/actions/marquee.js';
import { MARQUEE_MODES, TOKEN_COLORS } from '../utils/ui-constants.js';

const CELL = 40;

function tokenMap(list) {
  return new Map(list.map((t) => [t.id, t]));
}

describe('tokensInRect', () => {
  const tokens = tokenMap([
    { id: 'a', col: 0, row: 0, size: 1 },
    { id: 'b', col: 5, row: 5, size: 1 },
    { id: 'big', col: 2, row: 2, size: 3 },
  ]);

  it('returns the tokens the rectangle covers', () => {
    expect(tokensInRect({ tokens, cellPx: CELL, rect: { x1: 0, y1: 0, x2: 120, y2: 120 } }))
      .toEqual(['a', 'big']);
  });

  it('leaves out a token the rectangle misses', () => {
    expect(tokensInRect({ tokens, cellPx: CELL, rect: { x1: 0, y1: 0, x2: 30, y2: 30 } }))
      .toEqual(['a']);
  });

  it('catches a large token the rectangle only clips', () => {
    expect(tokensInRect({ tokens, cellPx: CELL, rect: { x1: 190, y1: 190, x2: 200, y2: 200 } }))
      .toEqual(['big']);
  });

  it('normalises a rectangle dragged up and to the left', () => {
    expect(tokensInRect({ tokens, cellPx: CELL, rect: { x1: 120, y1: 120, x2: 0, y2: 0 } }))
      .toEqual(['a', 'big']);
  });

  it('does not catch a token the rectangle only touches on its edge', () => {
    expect(tokensInRect({ tokens, cellPx: CELL, rect: { x1: 0, y1: 0, x2: 80, y2: 80 } }))
      .toEqual(['a']);
  });

  it('honours a token at free x/y coordinates rather than col/row', () => {
    const free = tokenMap([{ id: 'f', col: 9, row: 9, size: 1, x: 20, y: 20 }]);
    expect(tokensInRect({ tokens: free, cellPx: CELL, rect: { x1: 0, y1: 0, x2: 40, y2: 40 } }))
      .toEqual(['f']);
  });

  it('drops every token the caller says is not visible', () => {
    const ids = tokensInRect({
      tokens, cellPx: CELL, rect: { x1: 0, y1: 0, x2: 400, y2: 400 },
      isVisible: (t) => t.id !== 'big',
    });
    expect(ids).toEqual(['a', 'b']);
  });
});

function makeMr({ isGM = true, tokens = [] } = {}) {
  return {
    state: {
      isGM: () => isGM,
      map: { cell_px: CELL, width_cells: 10, height_cells: 10 },
      fog: { revealed: [] },
      tokens: tokenMap(tokens),
      isTokenVisibleToPlayer: () => true,
      updateFog: vi.fn(async () => {}),
    },
    stage: { container: () => ({ style: { cursor: '' } }) },
    render: vi.fn(),
    _toast: vi.fn(),
    setSelectedTokens: vi.fn(),
  };
}

describe('select is not a GM power', () => {
  it('arms select mode for a player', () => {
    const mr = makeMr({ isGM: false });
    startAreaSelection(mr, MARQUEE_MODES.SELECT);
    expect(mr.areaSelectionMode).toBe(MARQUEE_MODES.SELECT);
  });

  it('still refuses a player a fog reveal', () => {
    const mr = makeMr({ isGM: false });
    startAreaSelection(mr, MARQUEE_MODES.REVEAL);
    expect(mr.areaSelectionMode).toBeUndefined();
  });
});

describe('completing a select marquee', () => {
  const tokens = [
    { id: 'a', col: 0, row: 0, size: 1 },
    { id: 'far', col: 8, row: 8, size: 1 },
  ];

  it('hands the covered tokens to the renderer', async () => {
    const mr = makeMr({ tokens });
    beginSelectMarquee(mr, 0, 0);
    mr.areaSelectionCurrent = { x: 60, y: 60 };
    await completeAreaSelection(mr);
    expect(mr.setSelectedTokens).toHaveBeenCalledWith(['a']);
    expect(mr.areaSelectionMode).toBeNull();
  });

  it('never touches fog', async () => {
    const mr = makeMr({ tokens });
    beginSelectMarquee(mr, 0, 0);
    mr.areaSelectionCurrent = { x: 60, y: 60 };
    await completeAreaSelection(mr);
    expect(mr.state.updateFog).not.toHaveBeenCalled();
  });

  it('leaves the selection alone when the drag never moved', async () => {
    const mr = makeMr({ tokens });
    beginSelectMarquee(mr, 10, 10);
    mr.areaSelectionCurrent = { x: 11, y: 11 };
    await completeAreaSelection(mr);
    expect(mr.setSelectedTokens).not.toHaveBeenCalled();
  });

  it('gives a player only the tokens they can see', async () => {
    const mr = makeMr({ isGM: false, tokens: [
      { id: 'mine', col: 0, row: 0, size: 1 },
      { id: 'hidden', col: 1, row: 0, size: 1 },
    ] });
    mr.state.isTokenVisibleToPlayer = (t) => t.id !== 'hidden';
    beginSelectMarquee(mr, 0, 0);
    mr.areaSelectionCurrent = { x: 80, y: 40 };
    await completeAreaSelection(mr);
    expect(mr.setSelectedTokens).toHaveBeenCalledWith(['mine']);
  });

  it('routes reveal and hide to fog exactly as before', async () => {
    const mr = makeMr();
    startAreaSelection(mr, MARQUEE_MODES.REVEAL);
    mr.areaSelectionStart = { x: 0, y: 0 };
    mr.areaSelectionCurrent = { x: 80, y: 40 };
    await completeAreaSelection(mr);
    expect(mr.state.updateFog.mock.calls[0][0].revealed.sort())
      .toEqual(['0,0', '0,1', '1,0', '1,1', '2,0', '2,1']);
    expect(mr.setSelectedTokens).not.toHaveBeenCalled();
  });
});

describe('marqueeColors', () => {
  it('tints select with the accent so the three modes are not confusable', () => {
    expect(marqueeColors(MARQUEE_MODES.SELECT).stroke).toBe(TOKEN_COLORS.AREA_SELECT);
    expect(marqueeColors(MARQUEE_MODES.REVEAL).stroke).toBe(TOKEN_COLORS.AREA_REVEAL);
    expect(marqueeColors(MARQUEE_MODES.HIDE).stroke).toBe(TOKEN_COLORS.AREA_HIDE);
    const strokes = Object.values(MARQUEE_MODES).map((m) => marqueeColors(m).stroke);
    expect(new Set(strokes).size).toBe(3);
  });
});
