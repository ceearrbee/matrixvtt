/**
 * classifyItems - pure function that splits ui.state.items into three
 * buckets: byCharacter (in some PC's inventory), onMap (a token of
 * type:'item' with matching item_id), and loose (neither).
 */
import { describe, it, expect } from 'vitest';
import { classifyItems } from '../ui/items/classify.js';

function makeUi({ items = {}, characters = {}, tokens = {} } = {}) {
  return {
    state: {
      items: new Map(Object.entries(items)),
      characters: new Map(Object.entries(characters)),
      tokens: new Map(Object.entries(tokens)),
    },
  };
}

describe('classifyItems', () => {
  it("places an item in a character's inventory under byCharacter, keyed by item id", () => {
    const ui = makeUi({
      items: { 'itm-a': { name: 'Apple' } },
      characters: { 'chr-1': { name: 'Aria', inventory_ids: ['itm-a'] } },
    });
    const { byCharacter, onMap, loose } = classifyItems(ui);
    expect(byCharacter.get('itm-a')).toEqual({ charId: 'chr-1', charName: 'Aria' });
    expect(onMap.has('itm-a')).toBe(false);
    expect(loose.has('itm-a')).toBe(false);
  });

  it('places an item under onMap when a token of type:item carries its item_id', () => {
    const ui = makeUi({
      items: { 'itm-b': { name: 'Boot' } },
      tokens: { 'tok-x': { id: 'tok-x', type: 'item', item_id: 'itm-b' } },
    });
    const { byCharacter, onMap, loose } = classifyItems(ui);
    expect(onMap.has('itm-b')).toBe(true);
    expect(byCharacter.has('itm-b')).toBe(false);
    expect(loose.has('itm-b')).toBe(false);
  });

  it('puts orphan items (neither held nor on map) in loose', () => {
    const ui = makeUi({ items: { 'itm-c': { name: 'Cloak' } } });
    const { loose, byCharacter, onMap } = classifyItems(ui);
    expect(loose.has('itm-c')).toBe(true);
    expect(byCharacter.has('itm-c')).toBe(false);
    expect(onMap.has('itm-c')).toBe(false);
  });

  it('prefers byCharacter when an item is somehow both held and on map (defensive)', () => {
    const ui = makeUi({
      items: { 'itm-a': { name: 'Apple' } },
      characters: { 'chr-1': { name: 'Aria', inventory_ids: ['itm-a'] } },
      tokens: { 'tok-x': { id: 'tok-x', type: 'item', item_id: 'itm-a' } },
    });
    const { byCharacter, onMap } = classifyItems(ui);
    expect(byCharacter.has('itm-a')).toBe(true);
    expect(onMap.has('itm-a')).toBe(false);
  });

  it('handles characters with missing or undefined inventory_ids gracefully', () => {
    const ui = makeUi({
      items: { 'itm-a': { name: 'Apple' } },
      characters: {
        'chr-1': { name: 'Aria' }, // no inventory_ids
        'chr-2': { name: 'Kael', inventory_ids: null },
      },
    });
    const { loose } = classifyItems(ui);
    expect(loose.has('itm-a')).toBe(true);
  });

  it('ignores tokens of type:item that have no item_id', () => {
    const ui = makeUi({
      items: { 'itm-a': { name: 'Apple' } },
      tokens: { 'tok-x': { id: 'tok-x', type: 'item' } }, // no item_id
    });
    const { onMap, loose } = classifyItems(ui);
    expect(onMap.size).toBe(0);
    expect(loose.has('itm-a')).toBe(true);
  });
});
