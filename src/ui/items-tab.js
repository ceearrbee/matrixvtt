/**
 * items-tab.js - Items tab component and rendering.
 */

import { h } from 'preact';
import { useRef, useLayoutEffect } from 'preact/hooks';
import * as v from 'valibot';
import { FormReader, applyFieldErrors } from '../utils/ui-helpers.js';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';
import { reqText, optInt, optFloat } from '../utils/form-schemas.js';
import { EVENT_TYPES } from '../utils/constants.js';
import { saveChildEntity, confirmDeleteChildEntity } from './child-entity-crud.js';
import { allocateEntityId } from '../utils/stable-id.js';
import { showIconPicker } from './icon-picker/IconPickerModal.jsx';

export function showEditItemForm(ui, itemId) {
  ui.showItemForm(itemId);
}

// Types that surface the "Weapon Properties" block in the Add/Edit
// Item form. Empty / unset type is treated as weapon-shaped so a user
const WEAPON_SHAPED_TYPES = new Set(['', 'weapon', 'melee', 'ranged', 'firearm']);
function isWeaponShaped(type) {
  return WEAPON_SHAPED_TYPES.has(String(type ?? '').trim().toLowerCase());
}

function ItemForm({ ui, itemId, onClose }) {
  const isEdit = itemId !== null;
  const item = isEdit ? ui.state.items.get(itemId) : null;
  const formRef = useRef(null);

  // CSS hides `.weapon-properties` unless the modal body is marked
  // weapon-shaped. Toggle the marker imperatively (synchronously) so the
  // form stays coherent the instant the user changes the type, matching
  // the legacy behavior the tests pin. useLayoutEffect runs on mount
  // before paint so the initial marker is set without a flash.
  useLayoutEffect(() => {
    const form = formRef.current;
    const modalBody = form?.closest('.modal-body');
    if (!modalBody) return;
    const setWeaponShape = (type) => {
      if (isWeaponShaped(type)) modalBody.setAttribute('data-weapon-shaped', '');
      else modalBody.removeAttribute('data-weapon-shaped');
    };
    setWeaponShape(isEdit ? item.type : '');
    const typeInput = form.querySelector('#item-type');
    const onTypeInput = () => setWeaponShape(typeInput.value);
    typeInput?.addEventListener('input', onTypeInput);
    return () => typeInput?.removeEventListener('input', onTypeInput);
  }, []);

  const pickIcon = () => showIconPicker({
    onSelect: (url) => {
      const input = formRef.current?.querySelector('#item-image-url');
      if (input) input.value = url;
    },
  });

  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const ok = isEdit ? await ui.updateItem(form, itemId) : await ui.createItem(form);
    if (ok !== false) onClose();
  };

  const opt = (value, labelText) =>
    h('option', { value, selected: isEdit ? item.rarity === value : value === 'common' }, labelText);

  return h('form', { id: 'item-form', ref: formRef, onSubmit }, [
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'item-name' }, ['Item Name ', h('span', { 'aria-hidden': 'true' }, '*')]),
      h('input', {
        type: 'text', class: 'form-input', id: 'item-name', placeholder: 'e.g., Longsword',
        defaultValue: isEdit ? item.name : '', required: true, 'aria-required': 'true', title: 'The name of the item',
      }),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'item-image-url' }, 'Icon (optional)'),
      h('div', { style: 'display:flex;gap:6px;align-items:center;' }, [
        isEdit && item.image_url && h('img', {
          src: item.image_url, alt: '',
          style: 'width:32px;height:32px;object-fit:contain;border:1px solid var(--color-border-secondary);border-radius:var(--border-radius-sm);',
        }),
        h('input', {
          type: 'text', class: 'form-input', id: 'item-image-url', placeholder: 'Paste a URL or browse the library…',
          defaultValue: isEdit && item.image_url ? item.image_url : '', style: 'flex:1;',
        }),
        h('button', { type: 'button', class: 'dbt dbt--sm', id: 'item-pick-icon', title: 'Browse the built-in icon library', onClick: pickIcon }, '🗃 Library'),
      ]),
    ]),
    h('div', { class: 'form-row' }, [
      h('div', { class: 'form-group' }, [
        h('label', { class: 'form-label', for: 'item-type' }, 'Type'),
        h('input', { type: 'text', class: 'form-input', id: 'item-type', placeholder: 'e.g., Weapon', defaultValue: isEdit ? item.type : '', title: 'The category or type of item' }),
      ]),
      h('div', { class: 'form-group' }, [
        h('label', { class: 'form-label', for: 'item-quantity' }, 'Quantity'),
        h('input', { type: 'number', class: 'form-input', id: 'item-quantity', defaultValue: isEdit ? item.quantity : 1, min: '1', title: 'How many of this item are held' }),
      ]),
      h('div', { class: 'form-group' }, [
        h('label', { class: 'form-label', for: 'item-rarity' }, 'Rarity'),
        h('select', { class: 'form-select', id: 'item-rarity', title: 'The scarcity or power level of the item' }, [
          opt('common', 'Common'), opt('uncommon', 'Uncommon'), opt('rare', 'Rare'),
          opt('very rare', 'Very Rare'), opt('legendary', 'Legendary'),
        ]),
      ]),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'item-description' }, 'Description'),
      h('textarea', { class: 'form-textarea', id: 'item-description', placeholder: 'Item description...', title: "Details about the item's effects and lore", defaultValue: isEdit ? item.description : '' }),
    ]),
    h('div', { class: 'form-row' }, [
      h('div', { class: 'form-group' }, [
        h('label', { class: 'form-label', for: 'item-weight' }, 'Weight (lb)'),
        h('input', { type: 'number', class: 'form-input', id: 'item-weight', min: '0', step: '0.5', placeholder: 'e.g., 3', defaultValue: isEdit && item.weight != null ? item.weight : '', title: 'Weight per unit in pounds' }),
      ]),
      h('div', { class: 'form-group' }, [
        h('label', { class: 'form-label', for: 'item-cost' }, 'Cost (gp)'),
        h('input', { type: 'number', class: 'form-input', id: 'item-cost', min: '0', placeholder: 'e.g., 15', defaultValue: isEdit && item.cost_gp != null ? item.cost_gp : '', title: 'Value per unit in gold pieces' }),
      ]),
    ]),
    h('div', { class: 'weapon-properties' }, [
      h('div', { class: 'section-header' }, 'Weapon Properties (Optional)'),
      h('div', { class: 'form-row' }, [
        h('div', { class: 'form-group' }, [
          h('label', { class: 'form-label', for: 'item-attack' }, 'Attack Bonus'),
          h('input', { type: 'number', class: 'form-input', id: 'item-attack', placeholder: '+5', defaultValue: isEdit && item.attack_bonus ? item.attack_bonus : '', title: 'Bonus added to attack rolls' }),
        ]),
        h('div', { class: 'form-group' }, [
          h('label', { class: 'form-label', for: 'item-damage' }, 'Damage'),
          h('input', { type: 'text', class: 'form-input', id: 'item-damage', placeholder: '1d8+3', defaultValue: isEdit && item.damage ? item.damage : '', title: 'Dice formula for damage (e.g. 1d8+3)' }),
        ]),
        h('div', { class: 'form-group' }, [
          h('label', { class: 'form-label', for: 'item-damage-type' }, 'Damage Type'),
          h('input', { type: 'text', class: 'form-input', id: 'item-damage-type', placeholder: 'slashing', defaultValue: isEdit && item.damage_type ? item.damage_type : '', title: 'Type of damage (e.g. fire, piercing)' }),
        ]),
      ]),
      h('div', { class: 'form-group' }, [
        h('label', { class: 'form-label', for: 'item-properties' }, 'Properties (comma-separated)'),
        h('input', { type: 'text', class: 'form-input', id: 'item-properties', placeholder: 'e.g., Versatile, Finesse', defaultValue: isEdit && item.properties ? item.properties : '', title: 'Additional weapon keywords' }),
      ]),
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label', style: 'display:flex;align-items:center;gap:6px;cursor:pointer;', title: 'Whether the item is currently in use or worn' }, [
          h('input', { type: 'checkbox', id: 'item-equipped', defaultChecked: isEdit && !!item.equipped, 'aria-label': 'Item is equipped' }),
          'Equipped',
        ])),
    ]),
    h('div', { class: 'form-actions' }, [
      h('button', { type: 'button', class: 'dbt', 'data-modal-close': true, 'aria-label': 'Cancel and close', title: 'Cancel changes' }, 'Cancel'),
      h('button', { type: 'submit', class: 'dbt btn-primary', 'aria-label': isEdit ? 'Save item' : 'Add item', title: isEdit ? 'Save changes' : 'Add a new item' }, isEdit ? 'Save Item' : 'Add Item'),
    ]),
  ]);
}

export function showItemForm(ui, itemId = null) {
  const isEdit = itemId !== null;
  openModal((close) =>
    h(Modal, {
      id: 'item-form-modal',
      title: isEdit ? 'Edit Item' : 'Add Item',
      maxWidth: '500px',
      autoFocusSelector: '#item-name',
      onClose: close,
    }, h(ItemForm, { ui, itemId, onClose: close })),
  );
}

// Exported so tests can pin the schema. Item forms are read by
// FormReader, which uses `type: 'bool'` to read `checkbox.checked`
// (without it the field is read as text and the syncer drops the
// event with "Item equipped must be boolean").
export function getItemFormSchema() {
  const fields = {
    name:         { id: 'item-name' },
    type:         'item-type',
    quantity:     { id: 'item-quantity', type: 'int' },
    rarity:       'item-rarity',
    description:  'item-description',
    attack_bonus: { id: 'item-attack', type: 'int' },
    damage:       'item-damage',
    damage_type:  'item-damage-type',
    properties:   'item-properties',
    equipped:     { id: 'item-equipped', type: 'bool' },
    weight:       { id: 'item-weight', type: 'float' },
    cost_gp:      { id: 'item-cost', type: 'float' },
    image_url:    { id: 'item-image-url' },
  };
  const schema = v.object({
    name:     reqText('Item name'),
    quantity: optInt('Quantity', 0),
    weight:   optFloat('Weight', 0),
    cost_gp:  optFloat('Cost', 0),
  });
  return { fields, schema };
}

export async function createItem(ui, modal) {
  const character = ui.state.getCurrentCharacter();
  if (!character) { ui._toast('No character selected', 'info'); return false; }

  const { fields, schema } = getItemFormSchema();
  const { values: item, errors } = new FormReader(modal).validate(fields, schema);
  if (Object.keys(errors).length) {
    applyFieldErrors(modal, errors, fields);
    return false;
  }
  const itemId = await allocateEntityId('itm', ui.state.items);
  const charId = ui.state.getCurrentCharacterId();
  const updatedChar = { ...character, inventory_ids: [...(character.inventory_ids ?? []), itemId] };

  await saveChildEntity(ui, {
    eventType: EVENT_TYPES.ITEM,
    id: itemId, entity: item, noun: 'item', verb: 'create',
    parentUpdate: { charId, updated: updatedChar },
  });
  return true;
}

export async function updateItem(ui, modal, itemId) {
  const existing = ui.state.items.get(itemId);
  if (!existing) return false;
  const { fields, schema } = getItemFormSchema();
  const { values, errors } = new FormReader(modal).validate(fields, schema);
  if (Object.keys(errors).length) {
    applyFieldErrors(modal, errors, fields);
    return false;
  }
  const item = { ...existing, ...values };
  await saveChildEntity(ui, {
    eventType: EVENT_TYPES.ITEM,
    id: itemId, entity: item, noun: 'item', verb: 'update',
  });
  return true;
}

export async function deleteItem(ui, itemId) {
  const item = ui.state.items.get(itemId);
  confirmDeleteChildEntity(ui, {
    eventType: EVENT_TYPES.ITEM,
    id: itemId, noun: 'item', entityName: item?.name,
    parentLinkField: 'inventory_ids',
  });
}

export async function toggleEquipItem(ui, itemId) {
  const item = ui.state.items.get(itemId);
  if (!item || !ui.state.canEditEntity(ui.state.getCurrentCharacter())) return;
  const updated = { ...item, equipped: !item.equipped };
  await saveChildEntity(ui, {
    eventType: EVENT_TYPES.ITEM,
    id: itemId, entity: updated, noun: 'item', verb: 'save',
  });
}
