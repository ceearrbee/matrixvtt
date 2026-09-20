/**
 * Line-of-sight walls derived from a generated layout, so a generated
 * dungeon can arrive with vision that works.
 *
 * Colinear runs are merged. One segment per cell edge would put around
 * 900 walls on a 40x30 dungeon, and the fog reveal tests every wall for
 * every revealed cell; merging takes a rectangular room from twenty
 * segments to four, and that dungeon to a couple of hundred.
 */

import { TERRAIN } from './terrain.js';

const PASSABLE = new Set([TERRAIN.FLOOR, TERRAIN.ROUGH, TERRAIN.WATER]);

/**
 * @param {{width: number, height: number, cells: Uint8Array}|null} grid
 * @param {number} cellPx
 * @returns {Array<{p1: {x: number, y: number}, p2: {x: number, y: number}, blocks_sight: boolean, blocks_movement: boolean}>}
 */
export function wallsFromTerrain(grid, cellPx) {
  if (!grid) return [];
  return [
    ...mergeRuns(horizontalEdges(grid), cellPx, 'h'),
    ...mergeRuns(verticalEdges(grid), cellPx, 'v'),
  ];
}

/** Edges where a passable cell meets rock above or below it. */
function horizontalEdges(grid) {
  const edges = [];
  for (let row = 0; row <= grid.height; row += 1) {
    for (let col = 0; col < grid.width; col += 1) {
      const above = passable(grid, col, row - 1);
      const below = passable(grid, col, row);
      if (above !== below) edges.push({ line: row, at: col });
    }
  }
  return edges;
}

function verticalEdges(grid) {
  const edges = [];
  for (let col = 0; col <= grid.width; col += 1) {
    for (let row = 0; row < grid.height; row += 1) {
      const left = passable(grid, col - 1, row);
      const right = passable(grid, col, row);
      if (left !== right) edges.push({ line: col, at: row });
    }
  }
  return edges;
}

/** Consecutive edges on the same line become one segment. */
function mergeRuns(edges, cellPx, axis) {
  const byLine = new Map();
  for (const { line, at } of edges) {
    if (!byLine.has(line)) byLine.set(line, []);
    byLine.get(line).push(at);
  }

  const walls = [];
  for (const [line, positions] of byLine) {
    positions.sort((a, b) => a - b);
    let start = positions[0];
    let prev = positions[0];
    for (let i = 1; i <= positions.length; i += 1) {
      const current = positions[i];
      if (current === prev + 1) { prev = current; continue; }
      walls.push(segment(axis, line, start, prev + 1, cellPx));
      start = current;
      prev = current;
    }
  }
  return walls;
}

function segment(axis, line, from, to, cellPx) {
  const a = line * cellPx;
  const b1 = from * cellPx;
  const b2 = to * cellPx;
  const p1 = axis === 'h' ? { x: b1, y: a } : { x: a, y: b1 };
  const p2 = axis === 'h' ? { x: b2, y: a } : { x: a, y: b2 };
  return { p1, p2, blocks_sight: true, blocks_movement: true };
}

function passable(grid, col, row) {
  if (col < 0 || row < 0 || col >= grid.width || row >= grid.height) return false;
  return PASSABLE.has(grid.cells[row * grid.width + col]);
}
