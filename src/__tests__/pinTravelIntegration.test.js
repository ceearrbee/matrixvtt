/**
 * Travel end to end, against a real StateManager and its Yjs bridges.
 *
 * The ordering inside `travelToPin` rests on one assumption worth
 * proving rather than reasoning about: `updateToken` clamps col/row
 * against whichever map is active, so the map switch has to have
 * landed in `sm.map` before the party is written. A GM crossing from a
 * 4x4 room into a 30x30 field is the case that catches it - a stale
 * clamp drags the party to (3,3) instead of the gate at (20,20).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateManager } from '../state/StateManager.js';
import { SubscriptionManager } from '../widget/SubscriptionManager.js';
import { travelToPin } from '../map/actions/pin-travel.js';
import { ENTITY_TYPES } from '../utils/constants.js';

function makeState() {
  const widgetManager = {
    userId: '@gm:m', isStandalone: true, widgetApi: null,
    isGM: vi.fn(() => true), roomId: '!r:m', sendStateEvent: vi.fn(async () => ({})),
  };
  const state = new StateManager(widgetManager, new SubscriptionManager());
  state.settings = { gm_user_ids: ['@gm:m'] };
  state.powerLevels = { users: { '@gm:m': 50 } };
  return state;
}

const pc = (id, name, col, row, map_id) => ({
  id, map_id, type: ENTITY_TYPES.PC, name, col, row,
});

describe('walking the party from a small room into a large field', () => {
  let state, room, field;

  const walk = (pinId) => travelToPin({ state, render: () => {} }, { ...state.pins.get(pinId), id: pinId });

  beforeEach(async () => {
    state = makeState();
    // createMap allocates its own id, so read the ids back rather than
    // naming them.
    room = await state.createMap({ name: 'Guard room', width_cells: 4, height_cells: 4, cell_px: 40 });
    field = await state.createMap({ name: 'The field', width_cells: 30, height_cells: 30, cell_px: 40 });
    await state.switchMap(room);
    await state.addPin({ id: 'door', map_id: room, col: 1, row: 1, label: 'North door', target_pin_id: 'gate' });
    await state.addPin({ id: 'gate', map_id: field, col: 20, row: 20, label: 'The gate' });
  });

  it('the switch lands before the party is written, so nobody is clamped to the old room', async () => {
    await state.updateToken('t1', pc('t1', 'Aria', 0, 0, room));
    const moved = await walk('door');

    expect(moved).toBe(1);
    expect(state.activeMapId).toBe(field);
    const aria = state.tokens.get('t1');
    expect(aria.map_id).toBe(field);
    expect({ col: aria.col, row: aria.row }).toEqual({ col: 20, row: 20 });
  });

  it('a second traveller lands beside the first, not on top of them', async () => {
    await state.updateToken('t1', pc('t1', 'Aria', 0, 0, room));
    await state.updateToken('t2', pc('t2', 'Bo', 1, 0, room));
    await walk('door');

    const cells = ['t1', 't2'].map((id) => {
      const t = state.tokens.get(id);
      return `${t.col},${t.row}`;
    });
    expect(new Set(cells).size).toBe(2);
    expect(cells).toContain('20,20');
  });

  it('leaves the monsters in the guard room', async () => {
    await state.updateToken('t1', pc('t1', 'Aria', 0, 0, room));
    await state.updateToken('t9', {
      id: 't9', map_id: room, type: ENTITY_TYPES.NPC, name: 'Goblin', col: 2, row: 2,
    });
    await walk('door');

    expect(state.tokens.get('t9').map_id).toBe(room);
    expect(state.tokens.get('t1').map_id).toBe(field);
  });

  it('does not step onto a token already standing at the gate', async () => {
    // Placed while the field is active: updateToken clamps to whichever
    // map is active, so a token cannot be dropped at (20,20) from
    // inside a 4x4 room.
    await state.switchMap(field);
    await state.updateToken('t5', pc('t5', 'Cass', 20, 20, field));
    await state.switchMap(room);
    await state.updateToken('t1', pc('t1', 'Aria', 0, 0, room));
    await walk('door');

    const aria = state.tokens.get('t1');
    expect(`${aria.col},${aria.row}`).not.toBe('20,20');
    expect(Math.max(Math.abs(aria.col - 20), Math.abs(aria.row - 20))).toBe(1);
    expect(state.tokens.get('t5').col).toBe(20);
  });

  it('the return trip works, which is what makes it a door and not a chute', async () => {
    await state.updatePin('gate', { target_pin_id: 'door' });
    await state.updateToken('t1', pc('t1', 'Aria', 0, 0, room));
    await walk('door');
    await walk('gate');

    expect(state.activeMapId).toBe(room);
    const aria = state.tokens.get('t1');
    expect(aria.map_id).toBe(room);
    expect({ col: aria.col, row: aria.row }).toEqual({ col: 1, row: 1 });
  });
});
