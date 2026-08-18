/**
 * The Add/Edit Item form must not render "Weapon Properties"
 * (attack-bonus, damage, damage-type, properties, equipped) for every
 * item regardless of type. Notes, potions, etc. shouldn't see weapon
 * fields.
 *
 * Contract: when the item type is recognized as non-weapon-shaped,
 * the weapon block is hidden via a `data-weapon-shaped` attribute on
 * the modal body that the CSS keys off of. Toggling the type input
 * updates the attribute live, no modal re-open required.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { showItemForm } from '../ui/items-tab.js';

function makeUi() {
  return {
    state: { items: new Map() },
    createItem: () => {},
    updateItem: () => {},
    _toast: () => {},
  };
}

afterEach(() => {
  document.querySelectorAll('.modal-overlay').forEach((el) => el.remove());
});

describe('item form - conditional weapon properties', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('marks the form as weapon-shaped when no item type is set yet (Add Item, blank)', () => {
    const ui = makeUi();
    showItemForm(ui);
    const body = document.querySelector('#item-form-modal .modal-body');
    expect(body, 'modal body should be rendered').not.toBeNull();
    expect(body.getAttribute('data-weapon-shaped')).toBe('');
  });

  it('marks the form as weapon-shaped when editing a weapon-typed item', () => {
    const ui = makeUi();
    ui.state.items.set('itm1', { id: 'itm1', name: 'Longsword', type: 'weapon' });
    showItemForm(ui, 'itm1');
    const body = document.querySelector('#item-form-modal .modal-body');
    expect(body.getAttribute('data-weapon-shaped')).toBe('');
  });

  it('omits the weapon-shaped marker when editing a non-weapon item (e.g. note)', () => {
    const ui = makeUi();
    ui.state.items.set('itm2', { id: 'itm2', name: 'Crumpled letter', type: 'note' });
    showItemForm(ui, 'itm2');
    const body = document.querySelector('#item-form-modal .modal-body');
    expect(body.getAttribute('data-weapon-shaped')).toBeNull();
  });

  it('wraps weapon-only fields in a .weapon-properties container', () => {
    const ui = makeUi();
    showItemForm(ui);
    const container = document.querySelector('#item-form-modal .weapon-properties');
    expect(container, '.weapon-properties wrapper should exist').not.toBeNull();
    expect(container.querySelector('#item-attack')).not.toBeNull();
    expect(container.querySelector('#item-damage')).not.toBeNull();
  });

  it('toggles data-weapon-shaped live when the user changes the type input', () => {
    const ui = makeUi();
    showItemForm(ui);
    const body = document.querySelector('#item-form-modal .modal-body');
    const typeInput = document.querySelector('#item-type');
    expect(body.getAttribute('data-weapon-shaped')).toBe('');

    typeInput.value = 'note';
    typeInput.dispatchEvent(new Event('input', { bubbles: true }));
    expect(body.getAttribute('data-weapon-shaped')).toBeNull();

    typeInput.value = 'weapon';
    typeInput.dispatchEvent(new Event('input', { bubbles: true }));
    expect(body.getAttribute('data-weapon-shaped')).toBe('');
  });
});
