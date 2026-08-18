/**
 * Token-level "view this token's entity" entry point.
 *
 * PC / NPC tokens have a canonical home: the sidebar sheet. So this
 * routes them to selectCharacterById / selectNPCById (which selects the
 * entity and switches to its sheet tab) rather than opening a popup that
 * duplicates the sidebar. Item tokens have no sidebar sheet, so they keep
 * the item preview popup. Used by the map context-menu "View Sheet", the
 * token action bar, the command palette, initiative rows, and
 * double-click on a token.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { previewToken } from '../ui/preview/preview-token.js';

function makeUi() {
  const characters = new Map([['chr-1', { id: 'chr-1', name: 'Aria' }]]);
  const npcs = new Map([['npc-1', { id: 'npc-1', name: 'Goblin' }]]);
  const items = new Map([['itm-potion', { id: 'itm-potion', name: 'Healing Potion' }]]);
  const tokens = new Map([
    ['tok-pc',  { id: 'tok-pc',  sheet_id: 'chr-1', type: 'pc' }],
    ['tok-npc', { id: 'tok-npc', sheet_id: 'npc-1', type: 'npc' }],
    ['tok-orphan', { id: 'tok-orphan', sheet_id: 'missing' }],
    ['tok-item',   { id: 'tok-item', type: 'item', item_id: 'itm-potion', sheet_id: null }],
    ['tok-item-orphan', { id: 'tok-item-orphan', type: 'item', item_id: 'itm-ghost', sheet_id: null }],
    ['tok-prop',   { id: 'tok-prop', type: 'item', sheet_id: null }],
  ]);
  return {
    state: { characters, npcs, items, tokens, selectedToken: null },
    selectCharacterById: vi.fn(),
    selectNPCById: vi.fn(),
    showCharacterPreview: vi.fn(),
    showNPCPreview: vi.fn(),
    showItemPreview: vi.fn(),
    _toast: vi.fn(),
  };
}

describe('previewToken', () => {
  let ui;
  beforeEach(() => { ui = makeUi(); });

  it('routes a PC token to the sidebar sheet, not a popup', () => {
    previewToken(ui, 'tok-pc');
    expect(ui.selectCharacterById).toHaveBeenCalledWith('chr-1');
    expect(ui.showCharacterPreview).not.toHaveBeenCalled();
    expect(ui.selectNPCById).not.toHaveBeenCalled();
  });

  it('routes an NPC token to the sidebar NPC sheet, not a popup', () => {
    previewToken(ui, 'tok-npc');
    expect(ui.selectNPCById).toHaveBeenCalledWith('npc-1');
    expect(ui.showNPCPreview).not.toHaveBeenCalled();
    expect(ui.selectCharacterById).not.toHaveBeenCalled();
  });

  it('toasts when the token has a dangling sheet_id', () => {
    previewToken(ui, 'tok-orphan');
    expect(ui.showCharacterPreview).not.toHaveBeenCalled();
    expect(ui.showNPCPreview).not.toHaveBeenCalled();
    expect(ui._toast).toHaveBeenCalled();
    expect(ui._toast.mock.calls[0][0]).toMatch(/no sheet/i);
  });

  it('routes an item token to showItemPreview via item_id', () => {
    previewToken(ui, 'tok-item');
    expect(ui.showItemPreview).toHaveBeenCalledWith('itm-potion');
    expect(ui.showCharacterPreview).not.toHaveBeenCalled();
    expect(ui.showNPCPreview).not.toHaveBeenCalled();
    expect(ui._toast).not.toHaveBeenCalled();
  });

  it('toasts when an item token has a dangling item_id', () => {
    previewToken(ui, 'tok-item-orphan');
    expect(ui.showItemPreview).not.toHaveBeenCalled();
    expect(ui._toast).toHaveBeenCalled();
  });

  it('toasts when a prop / item-typed token has neither item_id nor sheet_id', () => {
    previewToken(ui, 'tok-prop');
    expect(ui._toast).toHaveBeenCalled();
  });

  it('silently no-ops when the token id is unknown', () => {
    expect(() => previewToken(ui, 'tok-missing')).not.toThrow();
    expect(ui._toast).not.toHaveBeenCalled();
  });
});
