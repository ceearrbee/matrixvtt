/**
 * Terrain painter. Draw calls only, against a recording context, so the
 * two styles can be asserted without a real canvas.
 */
import { describe, it, expect } from 'vitest';
import { TERRAIN, makeGrid, setAt } from '../map/generators/terrain.js';
import { PALETTES } from '../map/generators/palettes.js';
import { paintTerrain, MAX_BACKGROUND_EDGE, TILE_SPAN_CELLS, terrainCanvasSize } from '../map/generators/paint.js';

function recorder() {
  const calls = [];
  const ctx = {
    calls,
    canvas: { width: 0, height: 0 },
    createPattern: (img, repeat) => {
      calls.push(['createPattern', img.__id, repeat]);
      return { __pattern: img.__id, setTransform: (m) => calls.push(['setTransform', img.__id, m.a]) };
    },
    fillRect: (...a) => calls.push(['fillRect', ...a]),
    strokeRect: (...a) => calls.push(['strokeRect', ...a]),
    beginPath: () => calls.push(['beginPath']),
    moveTo: (...a) => calls.push(['moveTo', ...a]),
    lineTo: (...a) => calls.push(['lineTo', ...a]),
    stroke: () => calls.push(['stroke']),
    save: () => {},
    restore: () => {},
    scale: (...a) => calls.push(['scale', ...a]),
  };
  Object.defineProperty(ctx, 'fillStyle', { set: (v) => { calls.push(['fillStyle', v]); }, get: () => '' });
  Object.defineProperty(ctx, 'strokeStyle', { set: (v) => { calls.push(['strokeStyle', v]); }, get: () => '' });
  Object.defineProperty(ctx, 'lineWidth', { set: (v) => { calls.push(['lineWidth', v]); }, get: () => 1 });
  return ctx;
}

function roomGrid() {
  const g = makeGrid(4, 3, TERRAIN.WALL);
  setAt(g, 1, 1, TERRAIN.FLOOR);
  setAt(g, 2, 1, TERRAIN.FLOOR);
  return g;
}

const opts = (over = {}) => ({
  cellPx: 10, style: 'textured', palette: PALETTES.dungeon,
  tileImages: new Map(), ...over,
});

describe('terrainCanvasSize', () => {
  it('is the grid at its natural cell size when that fits', () => {
    expect(terrainCanvasSize(20, 15, 40)).toEqual({ width: 800, height: 600, scale: 1 });
  });

  // A 100x100 map at cell_px 100 is a 10000px canvas, which is ~400 MB of
  // backing store. Cap it and let Konva scale the result up.
  it('caps the longer edge and reports the scale it used', () => {
    const { width, height, scale } = terrainCanvasSize(100, 50, 100);
    expect(width).toBe(MAX_BACKGROUND_EDGE);
    expect(height).toBe(MAX_BACKGROUND_EDGE / 2);
    expect(scale).toBeCloseTo(MAX_BACKGROUND_EDGE / 10000);
  });

  it('never returns a zero-sized canvas', () => {
    const { width, height } = terrainCanvasSize(1, 1, 10);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });
});

describe('paintTerrain - textured', () => {
  it('fills floor from the tile image when the palette names one that is loaded', () => {
    const img = { __id: 'stone-floor', naturalWidth: 512 };
    const ctx = recorder();
    paintTerrain(ctx, roomGrid(), opts({ tileImages: new Map([['stone-floor', img]]) }));
    expect(ctx.calls.some(([m, id]) => m === 'createPattern' && id === 'stone-floor')).toBe(true);
  });

  // Without this the 512px tile maps 1:1 to canvas pixels, so the same
  // map looks like a smeared photo in the small preview and like proper
  // stone at the table. The tile has to span a fixed number of cells.
  it('scales the pattern so a tile spans the same cell count at any cell size', () => {
    const img = { __id: 'stone-floor', naturalWidth: 512 };
    const scaleAt = (cellPx) => {
      const ctx = recorder();
      paintTerrain(ctx, roomGrid(), opts({ cellPx, tileImages: new Map([['stone-floor', img]]) }));
      return ctx.calls.find(([m]) => m === 'setTransform')[2];
    };
    expect(scaleAt(10)).toBeCloseTo((10 * TILE_SPAN_CELLS) / 512);
    expect(scaleAt(40)).toBeCloseTo((40 * TILE_SPAN_CELLS) / 512);
    expect(scaleAt(40)).toBeCloseTo(scaleAt(10) * 4);
  });

  it('falls back to the palette colour when the tile has not loaded yet', () => {
    const ctx = recorder();
    paintTerrain(ctx, roomGrid(), opts());
    expect(ctx.calls.some(([m]) => m === 'createPattern')).toBe(false);
    expect(ctx.calls.some(([m, v]) => m === 'fillStyle' && v === PALETTES.dungeon.colors[TERRAIN.FLOOR])).toBe(true);
  });

  it('paints walls as solid colour, never as a floor texture', () => {
    const ctx = recorder();
    paintTerrain(ctx, roomGrid(), opts());
    expect(ctx.calls.some(([m, v]) => m === 'fillStyle' && v === PALETTES.dungeon.colors[TERRAIN.WALL])).toBe(true);
  });

  it('covers every cell of the grid', () => {
    const ctx = recorder();
    paintTerrain(ctx, roomGrid(), opts());
    const fills = ctx.calls.filter(([m]) => m === 'fillRect');
    expect(fills.length).toBeGreaterThanOrEqual(12);
  });
});

describe('paintTerrain - lines', () => {
  it('uses flat palette colour and strokes the layout instead of texturing it', () => {
    const img = { __id: 'stone-floor', naturalWidth: 512 };
    const ctx = recorder();
    paintTerrain(ctx, roomGrid(), opts({ style: 'lines', tileImages: new Map([['stone-floor', img]]) }));
    expect(ctx.calls.some(([m]) => m === 'createPattern')).toBe(false);
    expect(ctx.calls.some(([m, v]) => m === 'fillStyle' && v === PALETTES.dungeon.colors[TERRAIN.FLOOR])).toBe(true);
    expect(ctx.calls.some(([m]) => m === 'stroke')).toBe(true);
  });

  // The theme grid line is rgba(255,255,255,0.08), invisible on a light
  // floor. The whole point of this style is the line work, so it uses a
  // colour that reads against its own palette.
  it('strokes in a colour that contrasts with the floor it drew', () => {
    const ctx = recorder();
    paintTerrain(ctx, roomGrid(), opts({ style: 'lines' }));
    const stroke = ctx.calls.find(([m]) => m === 'strokeStyle');
    expect(stroke[1]).toBe(PALETTES.dungeon.colors[TERRAIN.WALL]);
  });

  it('draws a wall edge only where passable meets solid, not around every cell', () => {
    const ctx = recorder();
    paintTerrain(ctx, roomGrid(), opts({ style: 'lines' }));
    const segments = ctx.calls.filter(([m]) => m === 'moveTo').length;
    expect(segments).toBeGreaterThan(0);
    expect(segments).toBeLessThan(roomGrid().cells.length * 4);
  });
});

describe('paintTerrain - robustness', () => {
  it('skips a terrain code it does not know rather than throwing', () => {
    const g = makeGrid(2, 1, 99);
    const ctx = recorder();
    expect(() => paintTerrain(ctx, g, opts())).not.toThrow();
  });

  it('does nothing for a missing grid', () => {
    const ctx = recorder();
    paintTerrain(ctx, null, opts());
    expect(ctx.calls).toEqual([]);
  });
});
