/**
 * ui.patchEntity(id, patch) is the write path for inline sheet edits
 * (slot_list, tagged_list, box_track, resource_pool, button_action,
 * pending-modifier clears). It merges the patch over the stored entity
 * because the state writer replaces wholesale, and it routes PC vs NPC
 * by collection. The form-submit handler ui.updateCharacter(modal, id)
 * has a different signature; sections must never call it.
 */
import { describe, it, expect, vi } from 'vitest';
import { patchEntity } from '../ui/entity/patch.js';
import fs from 'node:fs';

function makeUi() {
  return {
    state: {
      characters: new Map([['c1', { id: 'c1', name: 'Toast', cliches: { cliche1: 'Old' }, hp_max: 9 }]]),
      npcs: new Map([['n1', { id: 'n1', name: 'Goon', stress: [false] }]]),
      updateCharacter: vi.fn().mockResolvedValue(undefined),
      updateNPC: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe('patchEntity', () => {
  it('merges the patch over the stored character and writes the full record', async () => {
    const ui = makeUi();
    await patchEntity(ui, 'c1', { cliches: { cliche1: 'Swashbuckler' } });
    expect(ui.state.updateCharacter).toHaveBeenCalledWith('c1', {
      id: 'c1', name: 'Toast', cliches: { cliche1: 'Swashbuckler' }, hp_max: 9,
    });
  });

  it('routes NPC ids to updateNPC', async () => {
    const ui = makeUi();
    await patchEntity(ui, 'n1', { stress: [true] });
    expect(ui.state.updateNPC).toHaveBeenCalledWith('n1', { id: 'n1', name: 'Goon', stress: [true] });
    expect(ui.state.updateCharacter).not.toHaveBeenCalled();
  });

  it('is a no-op for unknown ids', async () => {
    const ui = makeUi();
    await patchEntity(ui, 'missing', { x: 1 });
    expect(ui.state.updateCharacter).not.toHaveBeenCalled();
    expect(ui.state.updateNPC).not.toHaveBeenCalled();
  });

  it('merges record fields one level deep so sibling keys survive', async () => {
    const ui = makeUi();
    ui.state.characters.set('c2', { id: 'c2', name: 'Dirk', cliches: { cliche1: 'Swashbuckler', cliche2: 'Hacker' } });
    await patchEntity(ui, 'c2', { cliches: { cliche3: 'Pilot' } });
    expect(ui.state.updateCharacter).toHaveBeenCalledWith('c2', {
      id: 'c2', name: 'Dirk',
      cliches: { cliche1: 'Swashbuckler', cliche2: 'Hacker', cliche3: 'Pilot' },
    });
  });

  it('replaces arrays and scalars wholesale', async () => {
    const ui = makeUi();
    ui.state.characters.set('c3', { id: 'c3', hooks: ['old'], lucky_shots: 2 });
    await patchEntity(ui, 'c3', { hooks: ['new'], lucky_shots: 3 });
    expect(ui.state.updateCharacter).toHaveBeenCalledWith('c3', {
      id: 'c3', hooks: ['new'], lucky_shots: 3,
    });
  });
});

describe('no section calls the form-signature ui.updateCharacter', () => {
  it('sheet sections and dice helpers patch via ui.patchEntity', () => {
    const files = [
      'src/ui/character-sheet-sections/narrative.js',
      'src/ui/character-sheet-sections/lists.js',
      'src/ui/dice-helpers.js',
    ];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text.includes('ui?.updateCharacter?.('), `${file} still calls ui.updateCharacter`).toBe(false);
    }
  });
});
