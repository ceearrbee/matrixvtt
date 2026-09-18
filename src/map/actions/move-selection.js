/**
 * Moving every selected token by one delta.
 *
 * Each token commits through `updateTokenPosition`, so the wall check
 * and the ownership check apply per token. A blocked token holds its
 * ground and the rest still move: a group move that fails wholesale
 * because one member walked into a wall is worse than one that moves
 * what it can and says what it could not.
 */

export async function moveSelectionBy(mr, ids, dCol, dRow) {
  const map = mr.state?.map;
  let moved = 0;
  let blocked = 0;
  if (!map || !ids?.length) return { moved, blocked };

  for (const id of ids) {
    const token = mr.state.tokens.get(id);
    if (!token || !mr.state.canMoveToken?.(id)) continue;
    const size = token.size || 1;
    const col = clamp(token.col + dCol, 0, Math.max(0, map.width_cells - size));
    const row = clamp(token.row + dRow, 0, Math.max(0, map.height_cells - size));
    if (col === token.col && row === token.row) continue;
    try {
      await mr.state.updateTokenPosition(id, col, row);
      moved += 1;
    } catch {
      blocked += 1;
    }
  }
  mr.render?.();
  return { moved, blocked };
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
