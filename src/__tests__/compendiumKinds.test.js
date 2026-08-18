/**
 * Per-kind compendium add flows: each kind clones the SRD entry, resolves
 * id collisions with a suffix, and writes through the existing child
 * entity writers (spell/item link to the current character, NPC is global).
 */
import { describe, it, expect, vi } from 'vitest';
import { COMPENDIUM_KINDS } from '../ui/compendium/kinds.js';

function makeUi({ isGM = false, character = null } = {}) {
  const state = {
    isGM: () => isGM,
    spells: new Map(),
    items: new Map(),
    npcs: new Map(),
    getCurrentCharacter: () => character,
    getCurrentCharacterId: () => character?.id ?? null,
    updateSpell: vi.fn(async () => {}),
    updateItem: vi.fn(async () => {}),
    updateNPC: vi.fn(async () => {}),
    updateCharacter: vi.fn(async () => {}),
  };
  return { state, _toast: vi.fn() };
}

const SPELL_ENTRY = { id: 'srd-sp-fireball', name: 'Fireball', level: 3, school: 'Evocation', source: 'SRD 5.1' };
const ITEM_ENTRY = { id: 'srd-itm-rope', name: 'Rope', type: 'Adventuring Gear', rarity: 'common', quantity: 1, source: 'SRD 5.1' };
const NPC_ENTRY = { id: 'srd-npc-goblin', type: 'npc', name: 'Goblin', cr: '1/4', hp_max: 7, hp_current: 7, source: 'SRD 5.1' };

describe('spell kind', () => {
  it('writes the spell unprepared and links it to the current character', async () => {
    const character = { id: 'chr-1', name: 'Aria', spell_ids: ['spl-1'] };
    const ui = makeUi({ character });
    const ok = await COMPENDIUM_KINDS.spell.add(ui, SPELL_ENTRY);
    expect(ok).toBe(true);
    const [id, content] = ui.state.updateSpell.mock.calls[0];
    expect(id).toBe('srd-sp-fireball');
    expect(content).toMatchObject({ name: 'Fireball', prepared: false, source: 'SRD 5.1' });
    const [charId, updatedChar] = ui.state.updateCharacter.mock.calls[0];
    expect(charId).toBe('chr-1');
    expect(updatedChar.spell_ids).toEqual(['spl-1', 'srd-sp-fireball']);
  });

  it('does not mutate the compendium entry it clones', async () => {
    const ui = makeUi({ character: { id: 'chr-1', spell_ids: [] } });
    await COMPENDIUM_KINDS.spell.add(ui, SPELL_ENTRY);
    expect(SPELL_ENTRY).not.toHaveProperty('prepared');
  });

  it('suffixes the id when the campaign already has that spell id', async () => {
    const ui = makeUi({ character: { id: 'chr-1', spell_ids: [] } });
    ui.state.spells.set('srd-sp-fireball', {});
    await COMPENDIUM_KINDS.spell.add(ui, SPELL_ENTRY);
    const [id, content] = ui.state.updateSpell.mock.calls[0];
    expect(id).toBe('srd-sp-fireball-2');
    expect(content.id).toBe('srd-sp-fireball-2');
  });

  it('refuses without a current character', async () => {
    const ui = makeUi();
    const ok = await COMPENDIUM_KINDS.spell.add(ui, SPELL_ENTRY);
    expect(ok).toBe(false);
    expect(ui.state.updateSpell).not.toHaveBeenCalled();
  });
});

describe('item kind', () => {
  it('links to the current character inventory for players', async () => {
    const character = { id: 'chr-1', inventory_ids: [] };
    const ui = makeUi({ character });
    const ok = await COMPENDIUM_KINDS.item.add(ui, ITEM_ENTRY);
    expect(ok).toBe(true);
    expect(ui.state.updateItem.mock.calls[0][0]).toBe('srd-itm-rope');
    const [, updatedChar] = ui.state.updateCharacter.mock.calls[0];
    expect(updatedChar.inventory_ids).toEqual(['srd-itm-rope']);
  });

  it('adds loose (no character link) for GMs', async () => {
    const ui = makeUi({ isGM: true, character: { id: 'chr-1', inventory_ids: [] } });
    const ok = await COMPENDIUM_KINDS.item.add(ui, ITEM_ENTRY);
    expect(ok).toBe(true);
    expect(ui.state.updateItem).toHaveBeenCalled();
    expect(ui.state.updateCharacter).not.toHaveBeenCalled();
  });

  it('suffixes colliding item ids', async () => {
    const ui = makeUi({ isGM: true });
    ui.state.items.set('srd-itm-rope', {});
    ui.state.items.set('srd-itm-rope-2', {});
    await COMPENDIUM_KINDS.item.add(ui, ITEM_ENTRY);
    expect(ui.state.updateItem.mock.calls[0][0]).toBe('srd-itm-rope-3');
  });
});

describe('monster kind', () => {
  it('writes the NPC with the entry id when free', async () => {
    const ui = makeUi({ isGM: true });
    const ok = await COMPENDIUM_KINDS.monster.add(ui, NPC_ENTRY);
    expect(ok).toBe(true);
    const [id, content] = ui.state.updateNPC.mock.calls[0];
    expect(id).toBe('srd-npc-goblin');
    expect(content).toMatchObject({ name: 'Goblin', type: 'npc', hp_current: 7 });
  });

  it('suffixes colliding NPC ids so duplicates coexist', async () => {
    const ui = makeUi({ isGM: true });
    ui.state.npcs.set('srd-npc-goblin', {});
    await COMPENDIUM_KINDS.monster.add(ui, NPC_ENTRY);
    const [id, content] = ui.state.updateNPC.mock.calls[0];
    expect(id).toBe('srd-npc-goblin-2');
    expect(content.id).toBe('srd-npc-goblin-2');
  });
});
