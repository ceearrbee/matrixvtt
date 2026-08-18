import { describe, it, expect, vi, afterEach } from 'vitest';
import { createMinimalUI } from '../ui/ui-methods.js';
import { ENTITY_TYPES } from '../utils/constants.js';

// placeSheetOnMap must stamp the token with the active map's id. Without
// it the renderer's `token.map_id !== activeId` filter drops the token and
// the token schema rejects the write - the user sees a "placed" toast but
// nothing appears. See src/map/layers/tokens.js and src/utils/schemas/actors.js.

function makeUI({ activeMapId = 'map-1' } = {}) {
  const npc = { id: 'npc-1', name: 'Goblin', hp_current: 7, hp_max: 7, ac: 13 };
  const character = { id: 'char-1', name: 'Aria', hp_current: 32, hp_max: 32, ac: 14, claimed_by_user_id: null };
  const tokens = new Map();
  const state = {
    npcs: new Map([[npc.id, npc]]),
    characters: new Map([[character.id, character]]),
    tokens,
    map: { width_cells: 20, height_cells: 20 },
    activeMapId,
    updateToken: vi.fn(async (id, token) => { tokens.set(id, token); }),
  };
  const widgetManager = { isStandalone: true, userId: '@gm:s' };
  const ui = createMinimalUI(state, widgetManager, null);
  ui._toast = vi.fn();
  return { ui, state, tokens };
}

describe('placeSheetOnMap - map_id stamping', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('writes a token whose map_id matches the active map (NPC)', async () => {
    const { ui, state, tokens } = makeUI({ activeMapId: 'map-1' });

    await ui.placeSheetOnMap('npc-1', ENTITY_TYPES.NPC);

    expect(state.updateToken).toHaveBeenCalledTimes(1);
    const [, token] = state.updateToken.mock.calls[0];
    expect(token.map_id).toBe('map-1');
    expect([...tokens.values()][0].map_id).toBe('map-1');
  });

  it('writes a token whose map_id matches the active map (PC)', async () => {
    const { ui, state } = makeUI({ activeMapId: 'map-1' });

    await ui.placeSheetOnMap('char-1', ENTITY_TYPES.PC);

    const [, token] = state.updateToken.mock.calls[0];
    expect(token.map_id).toBe('map-1');
  });

  it('guards when there is no active map: no token written, error toast, no success toast', async () => {
    const { ui, state } = makeUI({ activeMapId: null });

    await ui.placeSheetOnMap('npc-1', ENTITY_TYPES.NPC);

    expect(state.updateToken).not.toHaveBeenCalled();
    expect(ui._toast).toHaveBeenCalledTimes(1);
    const [msg, type] = ui._toast.mock.calls[0];
    expect(msg).toMatch(/no active map/i);
    expect(type).toBe('error');
  });
});
