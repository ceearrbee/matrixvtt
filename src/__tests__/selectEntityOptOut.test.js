/**
 * `selectCharacterById` / `selectNPCById` accept `{ switchTab: false }`
 * to select the entity without yanking the user away from the current
 * tab. Used by the GM Items "on <name>" badge.
 */
import { describe, it, expect, vi } from 'vitest';
import { selectCharacterById, selectNPCById } from '../ui/entity/selection.js';

function makeUi() {
  const characters = new Map([['chr-1', { id: 'chr-1', name: 'Aria' }]]);
  const npcs = new Map([['npc-1', { id: 'npc-1', name: 'Goblin' }]]);
  return {
    state: {
      characters, npcs,
      tokens: new Map(),
      selectedCharacterId: null,
      selectedNPCId: null,
      selectedToken: null,
    },
    mapRenderer: null,
    switchTab: vi.fn(),
  };
}

describe('select{Character,NPC}ById - opt-out tab switch', () => {
  it('switches tab by default (back-compat)', () => {
    const ui = makeUi();
    selectCharacterById(ui, 'chr-1');
    expect(ui.switchTab).toHaveBeenCalled();
    expect(ui.state.selectedCharacterId).toBe('chr-1');
  });

  it('skips the tab switch when { switchTab: false } is passed (character)', () => {
    const ui = makeUi();
    selectCharacterById(ui, 'chr-1', { switchTab: false });
    expect(ui.switchTab).not.toHaveBeenCalled();
    expect(ui.state.selectedCharacterId).toBe('chr-1');
  });

  it('skips the tab switch when { switchTab: false } is passed (NPC)', () => {
    const ui = makeUi();
    selectNPCById(ui, 'npc-1', { switchTab: false });
    expect(ui.switchTab).not.toHaveBeenCalled();
    expect(ui.state.selectedNPCId).toBe('npc-1');
  });
});
