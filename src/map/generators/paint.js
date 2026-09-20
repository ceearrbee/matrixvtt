/**
 * Draws a terrain grid onto a 2D context. The only part of generation
 * that touches a canvas, which is why the generators themselves stay
 * testable with plain assertions.
 *
 * Two styles:
 *  - `textured` paints each terrain code with its palette tile, falling
 *    back to a flat palette colour until the tile decodes.
 *  - `lines` ignores the tiles entirely: the same flat palette colours
 *    plus a stroked outline where passable meets solid.
 */

import { TERRAIN } from './terrain.js';

/** Longer edge of the generated canvas. A 100x100 map at cell_px 100
 *  would otherwise be 10000px square, roughly 400 MB of backing store. */
export const MAX_BACKGROUND_EDGE = 2048;

/** How many grid cells one tile spans. Keeps stone the same size in the
 *  picker's small preview and on the table's full-size canvas. */
export const TILE_SPAN_CELLS = 6;

const PASSABLE = new Set([TERRAIN.FLOOR, TERRAIN.ROUGH, TERRAIN.WATER]);

export function terrainCanvasSize(widthCells, heightCells, cellPx) {
  const natural = Math.max(widthCells, heightCells) * cellPx;
  const scale = natural > MAX_BACKGROUND_EDGE ? MAX_BACKGROUND_EDGE / natural : 1;
  return {
    width: Math.max(1, Math.round(widthCells * cellPx * scale)),
    height: Math.max(1, Math.round(heightCells * cellPx * scale)),
    scale,
  };
}

export function paintTerrain(ctx, grid, { cellPx, style, palette, tileImages }) {
  if (!grid) return;
  const lines = style === 'lines';
  const patterns = lines ? new Map() : buildPatterns(ctx, palette, tileImages, cellPx);

  for (let row = 0; row < grid.height; row += 1) {
    for (let col = 0; col < grid.width; col += 1) {
      const code = grid.cells[row * grid.width + col];
      const fill = patterns.get(code) ?? palette.colors[code] ?? null;
      if (!fill) continue;
      ctx.fillStyle = fill;
      ctx.fillRect(col * cellPx, row * cellPx, cellPx, cellPx);
    }
  }

  if (lines) strokeOutlines(ctx, grid, cellPx, palette);
}

function buildPatterns(ctx, palette, tileImages, cellPx) {
  const patterns = new Map();
  for (const [code, tileId] of Object.entries(palette.tiles)) {
    const img = tileImages?.get(tileId);
    if (!img) continue;
    const pattern = ctx.createPattern(img, 'repeat');
    if (!pattern) continue;
    scalePattern(pattern, img, cellPx);
    patterns.set(Number(code), pattern);
  }
  return patterns;
}

/**
 * A tile is 512px; a cell is 10-100px. Left alone the pattern maps 1:1
 * to canvas pixels, so the same map reads as a smeared photo in the
 * preview and as stone at the table. Pin it to TILE_SPAN_CELLS instead.
 */
function scalePattern(pattern, img, cellPx) {
  if (typeof pattern.setTransform !== 'function') return;
  const source = img.naturalWidth || img.width;
  if (!source) return;
  const scale = (cellPx * TILE_SPAN_CELLS) / source;
  pattern.setTransform(new DOMMatrix([scale, 0, 0, scale, 0, 0]));
}

/**
 * One segment per passable/solid boundary, not a box per cell: a plan
 * view reads as rooms and corridors rather than graph paper.
 */
function strokeOutlines(ctx, grid, cellPx, palette) {
  ctx.beginPath();
  for (let row = 0; row < grid.height; row += 1) {
    for (let col = 0; col < grid.width; col += 1) {
      if (!PASSABLE.has(grid.cells[row * grid.width + col])) continue;
      const x = col * cellPx;
      const y = row * cellPx;
      if (!passableAt(grid, col, row - 1)) edge(ctx, x, y, x + cellPx, y);
      if (!passableAt(grid, col, row + 1)) edge(ctx, x, y + cellPx, x + cellPx, y + cellPx);
      if (!passableAt(grid, col - 1, row)) edge(ctx, x, y, x, y + cellPx);
      if (!passableAt(grid, col + 1, row)) edge(ctx, x + cellPx, y, x + cellPx, y + cellPx);
    }
  }
  ctx.strokeStyle = palette.colors[TERRAIN.WALL];
  ctx.lineWidth = Math.max(1, Math.round(cellPx / 12));
  ctx.stroke();
}

function edge(ctx, x1, y1, x2, y2) {
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
}

function passableAt(grid, col, row) {
  if (col < 0 || row < 0 || col >= grid.width || row >= grid.height) return false;
  return PASSABLE.has(grid.cells[row * grid.width + col]);
}
