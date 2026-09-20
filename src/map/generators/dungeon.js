/**
 * Rooms joined by corridors. The classic battlemap shape: rectangular
 * chambers, L-shaped halls between them, solid rock elsewhere.
 */

import { TERRAIN, makeGrid, at, setAt } from './terrain.js';

export function generateDungeon({ rng, width, height, params }) {
  const grid = makeGrid(width, height, TERRAIN.WALL);
  const rooms = placeRooms(grid, rng, params);

  if (rooms.length === 0) {
    carveRect(grid, 1, 1, width - 2, height - 2);
    return grid;
  }

  for (let i = 1; i < rooms.length; i += 1) {
    carveCorridor(grid, rng, centre(rooms[i - 1]), centre(rooms[i]), params.corridorWidth);
  }
  roughenEdges(grid, rng, params.rubble);
  return grid;
}

function placeRooms(grid, rng, params) {
  const rooms = [];
  for (let attempt = 0; attempt < params.roomAttempts; attempt += 1) {
    const w = params.roomMin + Math.floor(rng() * (params.roomMax - params.roomMin + 1));
    const h = params.roomMin + Math.floor(rng() * (params.roomMax - params.roomMin + 1));
    const x = 1 + Math.floor(rng() * Math.max(1, grid.width - w - 2));
    const y = 1 + Math.floor(rng() * Math.max(1, grid.height - h - 2));
    if (x + w > grid.width - 1 || y + h > grid.height - 1) continue;
    if (rooms.some((r) => overlaps(r, { x, y, w, h }))) continue;
    const room = { x, y, w, h };
    rooms.push(room);
    carveRect(grid, room.x, room.y, room.w, room.h);
  }
  return rooms;
}

// One cell of padding so two rooms never share a wall and read as one.
function overlaps(a, b) {
  return a.x - 1 < b.x + b.w && b.x - 1 < a.x + a.w
      && a.y - 1 < b.y + b.h && b.y - 1 < a.y + a.h;
}

function centre(room) {
  return { col: room.x + Math.floor(room.w / 2), row: room.y + Math.floor(room.h / 2) };
}

// Clamped to the interior: a wide corridor carved near the edge would
// otherwise punch a hole through the outer wall and let tokens walk off.
function carveRect(grid, x, y, w, h) {
  const top = Math.max(1, y);
  const left = Math.max(1, x);
  const bottom = Math.min(grid.height - 1, y + h);
  const right = Math.min(grid.width - 1, x + w);
  for (let row = top; row < bottom; row += 1) {
    for (let col = left; col < right; col += 1) setAt(grid, col, row, TERRAIN.FLOOR);
  }
}

function carveCorridor(grid, rng, from, to, thickness) {
  const horizontalFirst = rng() < 0.5;
  const elbow = horizontalFirst
    ? { col: to.col, row: from.row }
    : { col: from.col, row: to.row };
  carveLine(grid, from, elbow, thickness);
  carveLine(grid, elbow, to, thickness);
}

function carveLine(grid, from, to, thickness) {
  const stepCol = Math.sign(to.col - from.col);
  const stepRow = Math.sign(to.row - from.row);
  let { col, row } = from;
  for (;;) {
    carveRect(grid, col, row, thickness, thickness);
    if (col === to.col && row === to.row) break;
    if (col !== to.col) col += stepCol;
    else row += stepRow;
  }
}

/**
 * Scatter a little rubble on floor that touches rock. Purely visual, but
 * it stops long corridors reading as printer output.
 */
function roughenEdges(grid, rng, chance) {
  if (chance <= 0) return;
  for (let row = 0; row < grid.height; row += 1) {
    for (let col = 0; col < grid.width; col += 1) {
      if (at(grid, col, row) !== TERRAIN.FLOOR) continue;
      const touchesRock = at(grid, col + 1, row) === TERRAIN.WALL
        || at(grid, col - 1, row) === TERRAIN.WALL
        || at(grid, col, row + 1) === TERRAIN.WALL
        || at(grid, col, row - 1) === TERRAIN.WALL;
      if (touchesRock && rng() * 100 < chance) setAt(grid, col, row, TERRAIN.ROUGH);
    }
  }
}
