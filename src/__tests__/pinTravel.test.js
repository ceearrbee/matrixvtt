/**
 * Travel pins. A pin that names another pin as its destination is a
 * door: walking through it switches the map for the whole room and
 * carries the party with it.
 *
 * Neither half existed. Pins carried label, colour and gm_only and
 * nothing else, so a pin could not point anywhere; and no token had
 * ever changed maps - `map_id` was written once at creation and the
 * renderer simply skips a token that is not on the active map, so the
 * party was left behind by every existing map switch.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  destinationOf, travelPinsOn, partyTokensOn, arrivalCells, travelToPin,
} from '../map/actions/pin-travel.js';
import { validatePin } from '../utils/schemas/content.js';
import { ENTITY_TYPES } from '../utils/constants.js';

const CAVE = { id: 'map-1', width_cells: 20, height_cells: 20, cell_px: 40 };
const KEEP = { id: 'map-2', width_cells: 6, height_cells: 6, cell_px: 40 };

const door = { id: 'pin-1', map_id: 'map-1', col: 3, row: 3, label: 'Cave mouth', target_pin_id: 'pin-2' };
const arrival = { id: 'pin-2', map_id: 'map-2', col: 2, row: 2, label: 'Gatehouse' };
const plain = { id: 'pin-3', map_id: 'map-1', col: 9, row: 9, label: 'Campfire' };

const pins = () => new Map([['pin-1', door], ['pin-2', arrival], ['pin-3', plain]]);

describe('a pin can name its destination', () => {
  it('resolves the arrival pin', () => {
    expect(destinationOf(pins(), door)).toEqual(arrival);
  });

  it('resolves nothing for a plain annotation', () => {
    expect(destinationOf(pins(), plain)).toBeNull();
  });

  it('resolves nothing when the arrival pin has been deleted', () => {
    const orphaned = new Map([['pin-1', door]]);
    expect(destinationOf(orphaned, door)).toBeNull();
  });

  it('refuses to point at itself', () => {
    const loop = { ...door, target_pin_id: 'pin-1' };
    expect(destinationOf(new Map([['pin-1', loop]]), loop)).toBeNull();
  });

  it('lists the doors on one map, not its plain pins', () => {
    expect(travelPinsOn(pins(), 'map-1').map((p) => p.id)).toEqual(['pin-1']);
    expect(travelPinsOn(pins(), 'map-2')).toEqual([]);
  });

  it('is accepted by the pin schema as an optional string', () => {
    expect(validatePin(door)).toBe(true);
    expect(validatePin(plain)).toBe(true);
    expect(() => validatePin({ ...door, target_pin_id: 7 })).toThrow();
  });
});

describe('the party is the player characters on the map', () => {
  const tokens = () => new Map([
    ['t1', { map_id: 'map-1', type: ENTITY_TYPES.PC, name: 'Aria', col: 1, row: 1 }],
    ['t2', { map_id: 'map-1', type: ENTITY_TYPES.NPC, name: 'Goblin', col: 2, row: 1 }],
    ['t3', { map_id: 'map-2', type: ENTITY_TYPES.PC, name: 'Bo', col: 0, row: 0 }],
  ]);

  it('takes the PCs on that map and leaves the monsters behind', () => {
    expect(partyTokensOn(tokens(), 'map-1').map((t) => t.name)).toEqual(['Aria']);
  });

  it('carries the token id, which the collection holds as its key', () => {
    expect(partyTokensOn(tokens(), 'map-1')[0].id).toBe('t1');
  });
});

describe('arriving tokens cluster around the arrival pin', () => {
  it('puts the first token on the pin itself', () => {
    expect(arrivalCells(arrival, 1, { map: KEEP })).toEqual([{ col: 2, row: 2 }]);
  });

  it('rings the rest outward around it', () => {
    const cells = arrivalCells(arrival, 5, { map: KEEP });
    expect(cells).toHaveLength(5);
    expect(new Set(cells.map((c) => `${c.col},${c.row}`)).size).toBe(5);
    for (const c of cells) {
      expect(Math.max(Math.abs(c.col - 2), Math.abs(c.row - 2))).toBeLessThanOrEqual(1);
    }
  });

  it('steps over cells another token already holds', () => {
    const taken = new Set(['2,2', '1,1']);
    const cells = arrivalCells(arrival, 2, { map: KEEP, taken });
    expect(cells.map((c) => `${c.col},${c.row}`)).not.toContain('2,2');
    expect(cells.map((c) => `${c.col},${c.row}`)).not.toContain('1,1');
  });

  it('stays inside a small map rather than spilling off its edge', () => {
    const corner = { col: 0, row: 0 };
    const cells = arrivalCells(corner, 4, { map: { width_cells: 2, height_cells: 2 } });
    expect(cells).toEqual([
      { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 0, row: 1 }, { col: 1, row: 1 },
    ]);
  });

  it('returns what it can when the map has no room left', () => {
    const taken = new Set(['0,0', '1,0', '0,1', '1,1']);
    expect(arrivalCells({ col: 0, row: 0 }, 3, { map: { width_cells: 2, height_cells: 2 }, taken })).toEqual([]);
  });
});

function makeMr({ isGM = true } = {}) {
  const tokens = new Map([
    ['t1', { map_id: 'map-1', type: ENTITY_TYPES.PC, name: 'Aria', col: 1, row: 1 }],
    ['t2', { map_id: 'map-1', type: ENTITY_TYPES.NPC, name: 'Goblin', col: 2, row: 1 }],
  ]);
  return /** @type {any} */ ({
    render: vi.fn(),
    state: {
      isGM: () => isGM,
      pins: pins(),
      tokens,
      maps: new Map([['map-1', CAVE], ['map-2', KEEP]]),
      switchMap: vi.fn(async () => {}),
      updateToken: vi.fn(async () => {}),
    },
  });
}

describe('travelling through the door', () => {
  it('switches the map before moving anyone, because the writer clamps to the active map', async () => {
    const mr = makeMr();
    const order = [];
    mr.state.switchMap.mockImplementation(async () => { order.push('switch'); });
    mr.state.updateToken.mockImplementation(async () => { order.push('move'); });
    await travelToPin(mr, door);
    expect(order).toEqual(['switch', 'move']);
    expect(mr.state.switchMap).toHaveBeenCalledWith('map-2');
  });

  it('carries the party and leaves the monsters', async () => {
    const mr = makeMr();
    await travelToPin(mr, door);
    expect(mr.state.updateToken).toHaveBeenCalledTimes(1);
    const [id, payload] = mr.state.updateToken.mock.calls[0];
    expect(id).toBe('t1');
    expect(payload.map_id).toBe('map-2');
    expect({ col: payload.col, row: payload.row }).toEqual({ col: 2, row: 2 });
  });

  it('reports how many travelled', async () => {
    expect(await travelToPin(makeMr(), door)).toBe(1);
  });

  it('does nothing for a player', async () => {
    const mr = makeMr({ isGM: false });
    expect(await travelToPin(mr, door)).toBe(0);
    expect(mr.state.switchMap).not.toHaveBeenCalled();
  });

  it('does nothing for a pin that points nowhere', async () => {
    const mr = makeMr();
    expect(await travelToPin(mr, plain)).toBe(0);
    expect(mr.state.switchMap).not.toHaveBeenCalled();
  });

  it('still switches the map when the party has no tokens on it yet', async () => {
    const mr = makeMr();
    mr.state.tokens = new Map();
    expect(await travelToPin(mr, door)).toBe(0);
    expect(mr.state.switchMap).toHaveBeenCalledWith('map-2');
  });
});
