/**
 * src/map/fog-cells.js - memoized parsing of fog revealed-cell keys.
 *
 * Fog state stores revealed cells as "col,row" strings. Draw paths run
 * on every batchDraw (every token dragmove), so parsing is cached and
 * keyed on the revealed array's identity: writers and the syncer always
 * replace the array, never mutate it in place.
 */

export function parseRevealedCells(revealed) {
  const cells = [];
  for (const cell of revealed || []) {
    const [c, r] = cell.split(',').map(Number);
    cells.push([c, r]);
  }
  return cells;
}

export function createRevealedCellsCache() {
  let lastRevealed = null;
  let cells = [];
  return function getCells(revealed) {
    if (revealed !== lastRevealed) {
      lastRevealed = revealed;
      cells = parseRevealedCells(revealed);
    }
    return cells;
  };
}

export function createRevealedSetCache() {
  let lastRevealed = null;
  let set = new Set();
  return function getSet(revealed) {
    if (revealed !== lastRevealed) {
      lastRevealed = revealed;
      set = new Set(revealed || []);
    }
    return set;
  };
}
