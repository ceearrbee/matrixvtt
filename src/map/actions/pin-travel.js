/**
 * Travel pins. A pin that names another pin as its destination is a
 * door: moving through it switches the map for the whole room and
 * carries the party to the arrival pin.
 *
 * A pin names only `target_pin_id`, never a map. The arrival pin
 * already knows which map it sits on, so a single field cannot drift
 * out of step with a map that was renamed or deleted.
 *
 * Everything above `travelToPin` is pure, so the arrival geometry can
 * be tested without a stage.
 */
import { ENTITY_TYPES } from '../../utils/constants.js';
import { showErrorNotification, VTTError, ErrorType } from '../../utils/errorHandling.js';

/** The pin this one points at, or null when it points nowhere. */
export function destinationOf(pins, pin) {
  const targetId = pin?.target_pin_id;
  if (!targetId || !pins || targetId === pin.id) return null;
  const target = pins.get(targetId);
  if (!target || target.map_id === pin.map_id) return null;
  return { ...target, id: targetId };
}

/** The doors on one map, in the order the collection holds them. */
export function travelPinsOn(pins, mapId) {
  if (!pins) return [];
  const doors = [];
  for (const [id, pin] of pins) {
    if (!pin || pin.map_id !== mapId) continue;
    if (destinationOf(pins, { ...pin, id })) doors.push({ ...pin, id });
  }
  return doors;
}

/** The player characters standing on one map. */
export function partyTokensOn(tokens, mapId) {
  if (!tokens) return [];
  const party = [];
  for (const [id, token] of tokens) {
    if (token?.map_id === mapId && token.type === ENTITY_TYPES.PC) party.push({ ...token, id });
  }
  return party;
}

/**
 * `count` free cells clustered on `origin`, growing outward a ring at a
 * time so the party lands on the doorway rather than in a queue. Cells
 * already held by a token, and cells past the map's edge, are skipped;
 * a map with no room left yields fewer cells than asked for.
 */
export function arrivalCells(origin, count, { map = null, taken = new Set() } = {}) {
  const cells = [];
  if (count <= 0) return cells;
  const maxCol = Math.max(0, (map?.width_cells ?? 1) - 1);
  const maxRow = Math.max(0, (map?.height_cells ?? 1) - 1);
  const used = new Set(taken);
  const lastRing = maxCol + maxRow;
  for (let ring = 0; ring <= lastRing && cells.length < count; ring++) {
    for (let row = origin.row - ring; row <= origin.row + ring && cells.length < count; row++) {
      for (let col = origin.col - ring; col <= origin.col + ring && cells.length < count; col++) {
        const onRing = Math.max(Math.abs(row - origin.row), Math.abs(col - origin.col)) === ring;
        if (!onRing) continue;
        if (col < 0 || row < 0 || col > maxCol || row > maxRow) continue;
        const key = `${col},${row}`;
        if (used.has(key)) continue;
        used.add(key);
        cells.push({ col, row });
      }
    }
  }
  return cells;
}

/**
 * Walk the party through `pin`. Returns how many tokens travelled.
 *
 * The map switch happens first: `updateToken` clamps col/row against
 * whichever map is active, so the destination has to be active before
 * the party lands on it or a smaller map would pull them to its edge.
 */
export async function travelToPin(mr, pin) {
  const state = mr?.state;
  if (!state?.isGM?.()) return 0;
  const destination = destinationOf(state.pins, pin);
  if (!destination) return 0;

  const party = partyTokensOn(state.tokens, pin.map_id);
  const destinationMap = state.maps?.get(destination.map_id) ?? null;
  const taken = new Set();
  for (const token of state.tokens?.values() ?? []) {
    if (token?.map_id === destination.map_id) taken.add(`${token.col},${token.row}`);
  }
  const cells = arrivalCells(destination, party.length, { map: destinationMap, taken });

  await state.switchMap(destination.map_id);
  let moved = 0;
  for (let i = 0; i < party.length; i++) {
    const cell = cells[i];
    if (!cell) break;
    const { id, ...token } = party[i];
    await state.updateToken(id, { ...token, id, map_id: destination.map_id, col: cell.col, row: cell.row });
    moved++;
  }
  mr.render?.();
  return moved;
}

/**
 * The travel boundary: a map switch followed by a run of token writes,
 * any of which the homeserver can refuse. Every caller goes through
 * here rather than calling `travelToPin` bare.
 */
export function runTravel(mr, pin) {
  travelToPin(mr, pin).catch((err) => showErrorNotification(
    err instanceof VTTError ? err : new VTTError(ErrorType.STATE_WRITE, 'Could not move the party', err),
  ));
}
