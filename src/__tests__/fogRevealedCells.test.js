/**
 * Fog revealed-cell parsing must not re-run on every draw: paintFog's
 * sceneFunc executes on each tokens-layer batchDraw (so on every token
 * dragmove), and re-splitting every "col,row" string each time is
 * wasted hot-path work. The cache is keyed on the revealed array's identity: the state layer
 * replaces the array on every fog write, so reference equality is a
 * correct change signal.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  parseRevealedCells,
  createRevealedCellsCache,
  createRevealedSetCache,
} from '../map/fog-cells.js';

describe('parseRevealedCells', () => {
  it('parses "col,row" strings into numeric pairs', () => {
    expect(parseRevealedCells(['0,0', '3,5', '12,7'])).toEqual([
      [0, 0], [3, 5], [12, 7],
    ]);
  });

  it('returns [] for null, undefined, and empty input', () => {
    expect(parseRevealedCells(null)).toEqual([]);
    expect(parseRevealedCells(undefined)).toEqual([]);
    expect(parseRevealedCells([])).toEqual([]);
  });
});

describe('createRevealedCellsCache', () => {
  it('returns the same parsed array for the same revealed reference', () => {
    const getCells = createRevealedCellsCache();
    const revealed = ['1,2', '3,4'];
    const first = getCells(revealed);
    const second = getCells(revealed);
    expect(second).toBe(first);
    expect(first).toEqual([[1, 2], [3, 4]]);
  });

  it('re-parses when the revealed reference changes', () => {
    const getCells = createRevealedCellsCache();
    const first = getCells(['1,2']);
    const second = getCells(['1,2', '5,6']);
    expect(second).not.toBe(first);
    expect(second).toEqual([[1, 2], [5, 6]]);
  });
});

describe('createRevealedSetCache', () => {
  it('returns the same Set for the same revealed reference', () => {
    const getSet = createRevealedSetCache();
    const revealed = ['1,2', '3,4'];
    const first = getSet(revealed);
    expect(getSet(revealed)).toBe(first);
    expect(first.has('1,2')).toBe(true);
    expect(first.has('9,9')).toBe(false);
  });

  it('rebuilds when the revealed reference changes', () => {
    const getSet = createRevealedSetCache();
    const first = getSet(['1,2']);
    const second = getSet(['1,2', '5,6']);
    expect(second).not.toBe(first);
    expect(second.has('5,6')).toBe(true);
  });

  it('handles null and undefined as empty', () => {
    const getSet = createRevealedSetCache();
    expect(getSet(null).size).toBe(0);
    expect(getSet(undefined).size).toBe(0);
  });
});

describe('paintFog uses the injected cell getter', () => {
  it('draws revealed holes from getCells instead of re-splitting strings', async () => {
    const { paintFog } = await import('../map/layers/fog.js');
    const revealed = ['1,1', '2,3'];
    const mr = {
      state: {
        map: { width_cells: 10, height_cells: 10, cell_px: 40 },
        fog: { mode: 'hidden', revealed },
        isGM: () => false,
      },
    };
    const ctx = {
      beginPath: vi.fn(), rect: vi.fn(), fill: vi.fn(),
    };
    const getCells = vi.fn(() => [[1, 1], [2, 3]]);
    paintFog(ctx, mr, getCells);
    expect(getCells).toHaveBeenCalledWith(revealed);
    expect(ctx.rect).toHaveBeenCalledWith(40, 40, 40, 40);
    expect(ctx.rect).toHaveBeenCalledWith(80, 120, 40, 40);
  });
});
