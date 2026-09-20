/**
 * Moving arbitrary PCs and NPCs onto the active map.
 *
 * Travel pins already move the party between two maps they connect.
 * This is the manual version: a GM opening a fresh map needs to put
 * whoever they like on it, without a pin and without recreating tokens.
 */
import { describe, it, expect, vi } from 'vitest';
import { bringTokensToMap } from '../map/actions/bring-tokens.js';
import { ENTITY_TYPES } from '../utils/constants.js';

function makeState({ isGm = true, tokens = [], activeMapId = 'map-b' } = {}) {
  return {
    activeMapId,
    isGM: () => isGm,
    maps: new Map([
      ['map-a', { id: 'map-a', width_cells: 20, height_cells: 20, cell_px: 50 }],
      ['map-b', { id: 'map-b', width_cells: 10, height_cells: 10, cell_px: 50 }],
    ]),
    tokens: new Map(tokens.map((t) => [t.id, t])),
    updateToken: vi.fn().mockResolvedValue(undefined),
  };
}

const pc = (id, over = {}) => ({ id, name: id, type: ENTITY_TYPES.PC, map_id: 'map-a', col: 1, row: 1, ...over });
const npc = (id, over = {}) => ({ id, name: id, type: ENTITY_TYPES.NPC, map_id: 'map-a', col: 2, row: 2, ...over });

describe('bringTokensToMap', () => {
  it('moves the chosen tokens onto the active map', async () => {
    const state = makeState({ tokens: [pc('kael'), npc('orc')] });
    const moved = await bringTokensToMap(state, ['kael', 'orc'], { col: 5, row: 5 });
    expect(moved).toBe(2);
    for (const [, patch] of state.updateToken.mock.calls) {
      expect(patch.map_id).toBe('map-b');
    }
  });

  it('clusters them on the cell the GM picked', async () => {
    const state = makeState({ tokens: [pc('kael')] });
    await bringTokensToMap(state, ['kael'], { col: 4, row: 6 });
    const [, patch] = state.updateToken.mock.calls[0];
    expect(patch.col).toBe(4);
    expect(patch.row).toBe(6);
  });

  it('never stacks two arrivals on the same cell', async () => {
    const state = makeState({ tokens: [pc('a'), pc('b'), pc('c')] });
    await bringTokensToMap(state, ['a', 'b', 'c'], { col: 5, row: 5 });
    const cells = state.updateToken.mock.calls.map(([, p]) => `${p.col},${p.row}`);
    expect(new Set(cells).size).toBe(3);
  });

  it('avoids cells already occupied on the destination', async () => {
    const sitting = npc('dragon', { map_id: 'map-b', col: 5, row: 5 });
    const state = makeState({ tokens: [pc('kael'), sitting] });
    await bringTokensToMap(state, ['kael'], { col: 5, row: 5 });
    const [, patch] = state.updateToken.mock.calls[0];
    expect(`${patch.col},${patch.row}`).not.toBe('5,5');
  });

  it('keeps arrivals inside the destination map, which may be smaller', async () => {
    const state = makeState({ tokens: [pc('kael')] });
    await bringTokensToMap(state, ['kael'], { col: 99, row: 99 });
    const [, patch] = state.updateToken.mock.calls[0];
    expect(patch.col).toBeLessThan(10);
    expect(patch.row).toBeLessThan(10);
  });

  it('preserves everything else about the token', async () => {
    const state = makeState({ tokens: [pc('kael', { hp_current: 12, color: '#abc', sheet_id: 'chr-1' })] });
    await bringTokensToMap(state, ['kael'], { col: 3, row: 3 });
    const [id, patch] = state.updateToken.mock.calls[0];
    expect(id).toBe('kael');
    expect(patch).toMatchObject({ hp_current: 12, color: '#abc', sheet_id: 'chr-1', name: 'kael' });
  });

  it('ignores tokens already on this map rather than shuffling them', async () => {
    const state = makeState({ tokens: [npc('dragon', { map_id: 'map-b', col: 1, row: 1 })] });
    expect(await bringTokensToMap(state, ['dragon'], { col: 5, row: 5 })).toBe(0);
    expect(state.updateToken).not.toHaveBeenCalled();
  });

  it('ignores ids that are not tokens', async () => {
    const state = makeState({ tokens: [pc('kael')] });
    expect(await bringTokensToMap(state, ['ghost'], { col: 5, row: 5 })).toBe(0);
  });

  it('does nothing for an empty choice', async () => {
    const state = makeState({ tokens: [pc('kael')] });
    expect(await bringTokensToMap(state, [], { col: 5, row: 5 })).toBe(0);
  });

  it('is GM only', async () => {
    const state = makeState({ isGm: false, tokens: [pc('kael')] });
    expect(await bringTokensToMap(state, ['kael'], { col: 5, row: 5 })).toBe(0);
    expect(state.updateToken).not.toHaveBeenCalled();
  });

  it('falls back to the middle of the map with no origin', async () => {
    const state = makeState({ tokens: [pc('kael')] });
    await bringTokensToMap(state, ['kael']);
    const [, patch] = state.updateToken.mock.calls[0];
    expect(patch.col).toBe(5);
    expect(patch.row).toBe(5);
  });
});
