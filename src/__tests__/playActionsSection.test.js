/**
 * `play_actions` - sheet section that groups attacks / spells /
 * items / common-actions into one unified surface. Each button
 * fires the existing handler (`_showAttackModal`, `castSpell`,
 * `consumeItem`, `rollNPCAction`, common-action announce). The
 * resolvers used here are tested separately in
 * playActionsSources.test.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { _kindsForTest } from '../ui/characterSheetSections.js';

function makeUi({ tokens = new Map(), spells = new Map(), items = new Map(), commonActions = [] } = {}) {
  return {
    state: {
      canEditEntity: () => true,
      isGM: () => true,
      settings: { systemConfig: { combat: { common_actions: commonActions } } },
      tokens, spells, items,
      getCurrentCharacter: () => null,
    },
    _showAttackModal: vi.fn(),
    castSpell: vi.fn(),
    consumeItem: vi.fn(),
    rollNPCAction: vi.fn(),
    chat: { announceMessage: vi.fn() },
    _log: vi.fn(),
  };
}

const config = {
  kind: 'play_actions',
  groups: [
    { label: 'Attacks',  source: 'character_actions',     filter: 'attack' },
    { label: 'Spells',   source: 'spell_ids' },
    { label: 'Items',    source: 'inventory_consumables' },
    { label: 'Common',   source: 'ruleset_common_actions' },
  ],
};

beforeEach(() => { document.body.innerHTML = ''; });

describe('play_actions section', () => {
  it('renders one section per non-empty group, hides empty groups', () => {
    const ui = makeUi();
    const character = {
      id: 'c1',
      actions: [{ name: 'Shortsword', attack_bonus: 5, damage: '1d6+3' }],
      spell_ids: [], inventory_ids: [],
    };
    render(_kindsForTest.play_actions({ ui, character, config }));
    expect(screen.queryByText('Attacks')).toBeTruthy();
    expect(screen.queryByText('Spells')).toBeNull();
    expect(screen.queryByText('Items')).toBeNull();
    expect(screen.queryByText('Common')).toBeNull();
  });

  it('clicking an attack opens the attack modal with the right index', () => {
    const tokenId = 'tok-1';
    const tokens = new Map([[tokenId, { id: tokenId, sheet_id: 'c1' }]]);
    const ui = makeUi({ tokens });
    const character = { id: 'c1', actions: [{ name: 'Shortsword', attack_bonus: 5, damage: '1d6+3' }] };
    render(_kindsForTest.play_actions({ ui, character, config }));
    fireEvent.click(screen.getByRole('button', { name: /shortsword/i }));
    expect(ui._showAttackModal).toHaveBeenCalled();
    const [tid, idx] = ui._showAttackModal.mock.calls[0];
    expect(tid).toBe(tokenId);
    expect(idx).toBe(0);
  });

  it('clicking a spell calls castSpell with the spell id and character id', () => {
    const spells = new Map([['sp-mm', { id: 'sp-mm', name: 'Magic Missile', level: 1 }]]);
    const ui = makeUi({ spells });
    const character = { id: 'c1', spell_ids: ['sp-mm'], spell_slots: { '1': { total: 4, used: 1 } } };
    render(_kindsForTest.play_actions({ ui, character, config }));
    fireEvent.click(screen.getByRole('button', { name: /magic missile/i }));
    expect(ui.castSpell).toHaveBeenCalledWith('sp-mm', 'c1');
  });

  it('a spell with no remaining slots renders disabled and click is no-op', () => {
    const spells = new Map([['sp-mm', { id: 'sp-mm', name: 'Magic Missile', level: 1 }]]);
    const ui = makeUi({ spells });
    const character = { id: 'c1', spell_ids: ['sp-mm'], spell_slots: { '1': { total: 4, used: 4 } } };
    render(_kindsForTest.play_actions({ ui, character, config }));
    const btn = screen.getByRole('button', { name: /magic missile/i });
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(ui.castSpell).not.toHaveBeenCalled();
  });

  it('clicking a consumable item fires consumeItem with its id', () => {
    const items = new Map([['itm-potion', { id: 'itm-potion', name: 'Potion of Healing', kind: 'consumable', consumable: true, quantity: 3 }]]);
    const ui = makeUi({ items });
    const character = { id: 'c1', inventory_ids: ['itm-potion'] };
    render(_kindsForTest.play_actions({ ui, character, config }));
    fireEvent.click(screen.getByRole('button', { name: /potion of healing/i }));
    expect(ui.consumeItem).toHaveBeenCalledWith('itm-potion');
  });

  it('clicking a common action announces it via chat', () => {
    const ui = makeUi({ commonActions: [{ label: 'Dodge', description: 'Defensive' }] });
    const character = { id: 'c1', name: 'Aria' };
    render(_kindsForTest.play_actions({ ui, character, config }));
    fireEvent.click(screen.getByRole('button', { name: /dodge/i }));
    expect(ui.chat.announceMessage).toHaveBeenCalled();
    expect(ui.chat.announceMessage.mock.calls[0][0]).toMatch(/Aria.*Dodge/);
  });

  it('renders the empty-state when no group has any actions', () => {
    const ui = makeUi();
    const character = { id: 'c1', actions: [], spell_ids: [], inventory_ids: [] };
    render(_kindsForTest.play_actions({ ui, character, config }));
    expect(screen.getByText(/nothing to do|no actions/i)).toBeTruthy();
  });
});
