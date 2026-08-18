/**
 * Items.jsx - inventory tab.
 *
 * Two surfaces share the file:
 *   - `Items` (player-facing): renders the active character's inventory
 *     with equip/edit/delete controls.
 *   - `GMItemsView`: GM-only branch showing every item in the campaign
 *     with a two-bucket filter ("On character" / "Available / on map")
 *     and a holder badge per row.
 */

import { h } from 'preact';
import { Card } from './Card.jsx';
import { EditIcon, TrashIcon } from './icons/index.jsx';
import { useState } from 'preact/hooks';
import { itemsSignal, charactersSignal, tokensSignal } from '../state/signals.js';
import { renderItemCardSections, getItemSections } from './item-card-sections.js';
import { TabToolbar, SrdButton } from './TabToolbar.jsx';
import { classifyItems } from './items/classify.js';
import { SaveToLibraryButton } from './library/SaveToLibraryButton.jsx';
import { LIBRARY_KIND } from '../utils/constants.js';

/**
 * Item-card body sink. The `html` arg is built by `renderItemCardSections`
 * in `item-card-sections.js` - every user-authored field (name, damage
 * type, stat labels, badge values) routes through `esc()`, and the
 * description passes through `renderMarkdown`, which emits safe HTML.
 * Lock-in tests in src/__tests__/itemCardEscaping.test.js.
 */
function TrustedMarkup({ html }) {
  return h('div', { class: 'item-card__body', dangerouslySetInnerHTML: { __html: html } });
}

function HolderBadge({ ui, item_id, classification }) {
  const held = classification.byCharacter.get(item_id);
  if (held) {
    return h(
      'button',
      {
        class: 'item-card__tag item-card__tag--holder',
        'data-item-holder': held.charId,
        title: `Held by ${held.charName} - click to open their sheet`,
        onClick: e => {
          e.stopPropagation();
          // Stay on the Items tab so the GM can keep scanning the list.
          ui.selectCharacterById?.(held.charId, { switchTab: false });
        },
      },
      held.charName
    );
  }
  if (classification.onMap.has(item_id)) {
    return h('span', { class: 'item-card__tag', 'data-item-location': 'on-map' }, 'On map');
  }
  return h('span', { class: 'item-card__tag', 'data-item-location': 'loose' }, 'Unassigned');
}

function ItemCard({ ui, item, itemId, canEdit, holder = null }) {
  const ruleset = ui.state.settings.systemConfig;
  // Per-type sections from ruleset.item_kinds[type], falling back to
  // the shared ruleset.item_card.sections list.
  const sections = getItemSections(ruleset, item);
  const typeLabel = item.quantity > 1 ? `×${item.quantity}` : (item.type ?? '');
  const isEquipped = item.equipped === true;
  const bodyHtml = renderItemCardSections(item, sections);
  // Equip toggles personal equipped-state on the player's character;
  // GMs author and curate items but don't equip them.
  const canEquip = canEdit && !ui.state.isGM();

  // Top row: name + the actual action buttons (equip / edit / delete /
  // library). Everything descriptive (type, equipped, holder) drops to a
  // wrapping tags row below so nothing overflows the narrow sidebar.
  const actions = [
    canEquip &&
      h('button', {
        class: 'dbt dbt--compact',
        'aria-label': `${isEquipped ? 'Unequip' : 'Equip'} ${item.name}`,
        title: isEquipped ? 'Unequip' : 'Equip',
        onClick: e => { e.stopPropagation(); ui.toggleEquipItem(itemId); },
      }, isEquipped ? '◉' : '○'),
    canEdit &&
      h('button', {
        class: 'dbt dbt--compact',
        'aria-label': `Edit ${item.name}`, title: 'Edit item',
        onClick: e => { e.stopPropagation(); ui.showItemForm(itemId); },
      }, h(EditIcon, {})),
    canEdit &&
      h('button', {
        class: 'dbt dbt--compact',
        'aria-label': `Delete ${item.name}`, title: 'Delete item',
        style: 'color: var(--color-text-danger);',
        onClick: e => { e.stopPropagation(); ui.deleteItem(itemId); },
      }, h(TrashIcon, {})),
    canEdit && h(SaveToLibraryButton, { ui, kind: LIBRARY_KIND.ITEM, entity: item }),
  ].filter(Boolean);

  const tags = [
    typeLabel && h('span', { class: 'item-card__tag' }, typeLabel),
    isEquipped && h('span', { class: 'item-card__tag item-card__tag--ok' }, '✓ Equipped'),
    holder,
  ].filter(Boolean);

  return h(
    Card,
    {
      class: `item-card${isEquipped ? ' item-card--equipped' : ''}`,
      onActivate: () => ui.showItemPreview?.(itemId),
      ariaLabel: `View ${item.name ?? 'item'} details`,
    },
    [
      h('div', { class: 'item-card__top' }, [
        item.image_url && h('img', {
          src: item.image_url, alt: '', loading: 'lazy', class: 'item-card__icon',
        }),
        h('span', { class: 'item-card__name' }, item.name),
        actions.length > 0 && h('div', { class: 'item-card__actions' }, actions),
      ].filter(Boolean)),
      tags.length > 0 && h('div', { class: 'item-card__tags' }, tags),
      bodyHtml && h(TrustedMarkup, { html: bodyHtml }),
    ]
  );
}

function GMItemsView({ ui }) {
  const [filter, setFilter] = useState('character');
  const classification = classifyItems(ui);

  const allItems = [...ui.state.items.entries()];
  const matches = allItems.filter(([id]) => {
    if (filter === 'character') return classification.byCharacter.has(id);
    return !classification.byCharacter.has(id); // 'available' bucket
  });

  const filterBtn = (key, label) =>
    h(
      'button',
      {
        class: `dbt dbt--sm${filter === key ? ' dbt--active' : ''}`,
        'data-items-filter': key,
        'aria-pressed': String(filter === key),
        onClick: () => setFilter(key),
      },
      label
    );

  return h('div', { class: 'items-tab-wrapper' }, [
    h(TabToolbar, { title: 'All items', modifier: 'cluster' }, [
      filterBtn('character', 'On character'),
      filterBtn('available', 'Available / on map'),
      h(
        'button',
        {
          class: 'dbt dbt--sm btn-primary',
          id: 'add-item-btn',
          'aria-label': 'Add new item',
          title: 'Add item',
          onClick: () => ui.showItemForm(null),
        },
        '+ Add Item'
      ),
      h(SrdButton, { ui, kind: 'item' }),
    ]),
    matches.length === 0
      ? h('div', { class: 'empty-state' }, 'No items in this view.')
      : matches.map(([id, item]) =>
          h(ItemCard, {
            key: id,
            ui,
            item,
            itemId: id,
            canEdit: true,
            holder: h(HolderBadge, { ui, item_id: id, classification }),
          })
        ),
  ]);
}

export function Items({ ui }) {
  itemsSignal.value;
  charactersSignal.value;
  tokensSignal.value;

  if (ui.state.isGM()) return h(GMItemsView, { ui });

  const character = ui.state.getCurrentCharacter();
  if (!character) {
    return h('div', { class: 'empty-state' }, 'No character selected');
  }

  const canEdit = ui.state.canEditEntity(character);
  const itemsWithIds = (character.inventory_ids ?? [])
    .map(id => ({ id, item: ui.state.items.get(id) }))
    .filter(p => p.item);

  return h('div', { class: 'items-tab-wrapper' }, [
    h(TabToolbar, { title: `${character.name}'s Inventory` },
      canEdit &&
        h(
          'button',
          {
            class: 'dbt dbt--sm btn-primary',
            id: 'add-item-btn',
            'aria-label': 'Add new item to inventory',
            title: 'Add item',
            onClick: () => ui.showItemForm(null),
          },
          '+ Add Item'
        )
    ),
    itemsWithIds.length === 0
      ? h(
          'div',
          { class: 'empty-state' },
          canEdit
            ? 'No items in this inventory. Use + Add Item to create one.'
            : 'No items in this inventory.'
        )
      : itemsWithIds.map(({ id, item }) => h(ItemCard, { key: id, ui, item, itemId: id, canEdit })),
  ]);
}
