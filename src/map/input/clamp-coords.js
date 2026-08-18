/**
 * clampToMap - turn world coords into integer cell col/row clamped to
 * the map's bounds. Returns 0/0 if the map is missing so callers can't
 * accidentally produce negative integers that the token schema rejects.
 *
 * Worth its own file because two click handlers (drop-on-map and
 * right-click → "Add Token Here") both produce raw `Math.floor(worldX
 * / cellPx)` values that can drift past 0 / max_cells when the user
 * clicks near a panned origin or the map edge.
 */
export function clampToMap(map, col, row) {
  if (!map) return { col: 0, row: 0 };
  const maxCol = Math.max(0, (map.width_cells ?? 1) - 1);
  const maxRow = Math.max(0, (map.height_cells ?? 1) - 1);
  return {
    col: Math.min(maxCol, Math.max(0, Math.floor(Number(col) || 0))),
    row: Math.min(maxRow, Math.max(0, Math.floor(Number(row) || 0))),
  };
}
