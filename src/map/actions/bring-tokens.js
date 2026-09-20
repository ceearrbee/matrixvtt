/**
 * Move arbitrary tokens onto the active map.
 *
 * Travel pins already carry the party between two maps a pin connects.
 * This is the manual counterpart: a GM who has just made a new map
 * needs to put whoever they like on it, without wiring up a pin and
 * without recreating tokens that already exist with their own HP,
 * conditions and sheet links.
 *
 * Arrival cells come from the same helper travel uses, so tokens land
 * clustered on the chosen cell, never stacked, and never outside a
 * destination map that happens to be smaller.
 */

import { arrivalCells } from './pin-travel.js';

/**
 * @param {object} state - StateManager
 * @param {string[]} tokenIds
 * @param {{col: number, row: number}} [origin] - where to cluster them;
 *   defaults to the middle of the map
 * @returns {Promise<number>} how many tokens moved
 */
export async function bringTokensToMap(state, tokenIds, origin = null) {
  if (!state?.isGM?.()) return 0;
  const mapId = state.activeMapId;
  const map = state.maps?.get(mapId) ?? null;
  if (!map) return 0;

  const moving = (tokenIds ?? [])
    .map((id) => {
      const token = state.tokens?.get?.(id);
      return token ? { ...token, id } : null;
    })
    .filter((token) => token && token.map_id !== mapId);
  if (moving.length === 0) return 0;

  const taken = new Set();
  for (const token of state.tokens?.values() ?? []) {
    if (token?.map_id === mapId) taken.add(`${token.col},${token.row}`);
  }

  const cells = arrivalCells(clampToMap(origin ?? centreOf(map), map), moving.length, { map, taken });

  let moved = 0;
  for (let i = 0; i < moving.length; i += 1) {
    const cell = cells[i];
    if (!cell) break;
    const { id, ...token } = moving[i];
    await state.updateToken(id, { ...token, id, map_id: mapId, col: cell.col, row: cell.row });
    moved += 1;
  }
  return moved;
}

function centreOf(map) {
  return {
    col: Math.floor((map.width_cells ?? 1) / 2),
    row: Math.floor((map.height_cells ?? 1) / 2),
  };
}

/**
 * `arrivalCells` only searches rings up to the map's own span, so an
 * origin well outside it finds nothing at all and the move silently
 * does nothing. Pull it inside first.
 */
function clampToMap(origin, map) {
  const maxCol = Math.max(0, (map.width_cells ?? 1) - 1);
  const maxRow = Math.max(0, (map.height_cells ?? 1) - 1);
  return {
    col: Math.min(maxCol, Math.max(0, Math.round(origin.col ?? 0))),
    row: Math.min(maxRow, Math.max(0, Math.round(origin.row ?? 0))),
  };
}
