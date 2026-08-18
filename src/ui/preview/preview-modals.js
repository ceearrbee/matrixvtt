/**
 * preview-modals.js - read-only-but-interactive popups for entities
 * (PC / NPC) and items.
 *
 * Each helper reads a ruleset-declared section list (`<x>_preview` or
 * the existing `<x>_sheet` / `item_card` as fallback), dispatches it
 * through the same renderers the Sheet tab uses, and wraps the result
 * in a ModalFactory modal with a footer that exposes "View Full Sheet"
 * (or "Edit") + "Close".
 *
 * The renderers are shared with the always-on Sheet tab, so any
 * interactivity that already works there (saves rolls, action_list
 * rolls) keeps working in the preview without extra wiring. Item
 * preview adds a delegated click handler for the new
 * attack_roll / damage_roll / use_consumable kinds.
 *
 * Ruleset-agnostic: every formula and field comes from
 * `ui.state.settings.systemConfig`. No D&D-isms in this file.
 */

import { h } from 'preact';
import { useRef, useLayoutEffect } from 'preact/hooks';
import { Modal } from '../Modal.jsx';
import { openModal } from '../modal-host.js';
import { renderSectionList, renderPrivateNotesSection } from '../characterSheetSections.js';
import { renderItemCardSections } from '../item-card-sections.js';
import { renderSpellPreviewSections } from '../spell-preview-sections.js';
import { fireFormulaRoll, getRollFormula, expandFormula } from '../dice-helpers.js';
import { ENTITY_TYPES } from '../../utils/constants.js';
import { esc } from '../../utils/component.js';

function _previewSections(ui, kind) {
  const cfg = ui.state.settings.systemConfig;
  if (!cfg) return [];
  if (kind === 'character') return cfg.character_preview?.sections ?? cfg.character_sheet?.sections ?? [];
  if (kind === 'npc')       return cfg.npc_preview?.sections       ?? cfg.npc_sheet?.sections       ?? cfg.character_sheet?.sections ?? [];
  if (kind === 'item')      return cfg.item_preview?.sections      ?? cfg.item_card?.sections       ?? [];
  if (kind === 'spell')     return cfg.spell_preview?.sections     ?? cfg.spell_card?.sections      ?? [];
  return [];
}

// Test-only re-export so the fallback chain is unit-testable without
// the modal infrastructure. Production callers use `_previewSections`
// indirectly via the *Preview functions below.
export const _previewSectionsForTest = _previewSections;

// Public alias so other surfaces (the content-library preview) can reuse
// the same ruleset-driven section fallback chain.
export const previewSectionsFor = _previewSections;

function _entitySubtitle(entity, kind) {
  if (kind === 'character') {
    const parts = [entity.class_level, entity.species].filter(Boolean);
    return parts.join(' · ');
  }
  // NPC
  const parts = [
    entity.cr != null ? `CR ${entity.cr}` : null,
    entity.size_category,
    entity.creature_type,
  ].filter(Boolean);
  return parts.join(' · ');
}

function _renderEntityPreview(ui, entity, kind, close) {
  const sections = _previewSections(ui, kind);
  const subtitle = _entitySubtitle(entity, kind);
  const isPC = kind === 'character';
  return h('div', { class: 'preview-modal' }, [
    h('div', { class: 'preview-modal__header' }, [
      h('div', { class: 'preview-modal__name' }, entity.name || (isPC ? 'Character' : 'NPC')),
      subtitle && h('div', { class: 'preview-modal__sub' }, subtitle),
    ]),
    h('div', { class: 'preview-modal__body' }, [
      ...renderSectionList(ui, entity, sections),
      renderPrivateNotesSection(ui, entity),
    ]),
    h('div', { class: 'preview-modal__footer form-actions' }, [
      h('button', {
        class: 'dbt', type: 'button',
        onClick: () => {
          close();
          if (isPC) ui.selectCharacterById?.(entity.id);
          else ui.selectNPCById?.(entity.id);
        },
      }, 'View Full Sheet'),
      ui.state.canEditEntity?.(entity) && h('button', {
        class: 'dbt', type: 'button',
        onClick: () => {
          close();
          if (isPC) ui.showEditCharacterForm?.(entity.id);
          else ui.showEntityForm?.(ENTITY_TYPES.NPC, entity.id);
        },
      }, 'Edit'),
      h('button', { class: 'dbt btn-primary', type: 'button', 'data-modal-close': true }, 'Close'),
    ]),
  ]);
}

export function showCharacterPreview(ui, charId) {
  _showEntityPreview(ui, charId, 'character');
}

export function showNPCPreview(ui, npcId) {
  _showEntityPreview(ui, npcId, 'npc');
}

function _showEntityPreview(ui, entityId, kind) {
  const collection = kind === 'character' ? ui.state.characters : ui.state.npcs;
  const entity = collection?.get?.(entityId);
  if (!entity) return;
  openModal((close) =>
    h(Modal, {
      id: 'preview-modal',
      title: entity.name || (kind === 'character' ? 'Character' : 'NPC'),
      maxWidth: '640px',
      onClose: close,
    }, _renderEntityPreview(ui, entity, kind, close)),
  );
}

/**
 * Render a section-HTML preview body (built by the reused, sanitized
 * item/spell section renderers) inside a Modal, wiring a delegated
 * click handler scoped to this preview for the rollable actions.
 */
function PreviewBody({ bodyHtml, modifier, canEdit, onEdit, onAction }) {
  const rootRef = useRef(null);
  useLayoutEffect(() => {
    const root = rootRef.current;
    root.addEventListener('click', onAction);
    return () => root.removeEventListener('click', onAction);
  }, []);
  return h('div', { class: `preview-modal ${modifier}`, ref: rootRef }, [
    h('div', { class: 'preview-modal__body', dangerouslySetInnerHTML: { __html: bodyHtml || '<p class="muted-small">No details.</p>' } }),
    h('div', { class: 'preview-modal__footer form-actions' }, [
      canEdit && h('button', { class: 'dbt', type: 'button', onClick: onEdit }, 'Edit'),
      h('button', { class: 'dbt btn-primary', type: 'button', 'data-modal-close': true }, 'Close'),
    ]),
  ]);
}

export function showItemPreview(ui, itemId) {
  const item = ui.state.items?.get?.(itemId);
  if (!item) return;
  // Honor per-type item_kinds first; fall back to item_preview /
  // item_card via the existing fallback chain.
  const ruleset = ui.state.settings.systemConfig;
  const perType = ruleset?.item_kinds?.[String(item.type ?? '').trim().toLowerCase()]?.sections;
  const sections = perType ?? _previewSections(ui, 'item');
  const bodyHtml = renderItemCardSections({ ...item, id: itemId }, sections);
  const canEdit = ui.state.canEditEntity?.(ui.state.getCurrentCharacter?.());

  const onAction = (e) => {
    const btn = e.target.closest?.('[data-item-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-item-action');
    const id = btn.getAttribute('data-item-id');
    const fresh = id ? ui.state.items?.get?.(id) : item;
    if (!fresh) return;
    if (action === 'attack-roll') {
      const formula = expandFormula(ui, getRollFormula(ui, 'attack'), { bonus: fresh.attack_bonus ?? 0 });
      fireFormulaRoll(ui, formula, `${fresh.name ?? 'item'} attack`);
    } else if (action === 'damage-roll') {
      const damage = btn.getAttribute('data-damage') || fresh.damage;
      if (damage) fireFormulaRoll(ui, damage, `${fresh.name ?? 'item'} damage${fresh.damage_type ? ` (${fresh.damage_type})` : ''}`);
    } else if (action === 'use-consumable') {
      _consumeItem(ui, id || itemId);
    }
  };

  openModal((close) =>
    h(Modal, { id: 'preview-modal', title: item.name || 'Item', maxWidth: '520px', onClose: close },
      h(PreviewBody, {
        bodyHtml, modifier: 'preview-modal--item', canEdit,
        onEdit: () => { close(); ui.showItemForm?.(itemId); }, onAction,
      })),
  );
}

export function showSpellPreview(ui, spellId, casterId = null) {
  const spell = ui.state.spells?.get?.(spellId);
  if (!spell) return;
  const sections = _previewSections(ui, 'spell');
  const bodyHtml = renderSpellPreviewSections({ ...spell, id: spellId }, sections);
  const canEdit = ui.state.canEditEntity?.(ui.state.getCurrentCharacter?.());

  const onAction = (e) => {
    const btn = e.target.closest?.('[data-spell-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-spell-action');
    const id = btn.getAttribute('data-spell-id');
    const fresh = id ? ui.state.spells?.get?.(id) : spell;
    if (!fresh) return;
    if (action === 'cast') {
      _castSpell(ui, id || spellId, casterId);
    } else if (action === 'damage') {
      const damage = btn.getAttribute('data-damage') || fresh.damage;
      if (damage) fireFormulaRoll(ui, damage, `${fresh.name ?? 'spell'} damage${fresh.damage_type ? ` (${fresh.damage_type})` : ''}`);
    } else if (action === 'save') {
      _announceSpellSave(ui, fresh, casterId);
    }
  };

  openModal((close) =>
    h(Modal, { id: 'preview-modal', title: spell.name || 'Spell', maxWidth: '560px', onClose: close },
      h(PreviewBody, {
        bodyHtml, modifier: 'preview-modal--spell', canEdit,
        onEdit: () => { close(); ui.showSpellForm?.(spellId); }, onAction,
      })),
  );
}

// Exported for the play-actions surface + sheet sections that need to
// fire the cast/consume path without routing through the preview
// modal. The underscore prefix is retained on the legacy alias so the
// existing internal call sites don't churn; the new exports are
// `castSpell` and `consumeItem`.
export { _castSpell as castSpell, _consumeItem as consumeItem };

async function _castSpell(ui, spellId, casterId) {
  const spell = ui.state.spells?.get?.(spellId);
  if (!spell) return;
  const caster = casterId ? ui.state.characters?.get?.(casterId) : ui.state.getCurrentCharacter?.();
  if (spell.level === 0 || spell.level == null) {
    ui._log?.('🪄', `${esc(String(caster?.name ?? 'Caster'))} casts <b>${esc(String(spell.name ?? 'spell'))}</b>`);
    _fireSpellEffects(ui, spell, caster);
    return;
  }
  if (!caster) {
    ui._log?.('🪄', `<b>${esc(String(spell.name ?? 'spell'))}</b> cast (no character context)`);
    _fireSpellEffects(ui, spell, null);
    return;
  }
  const slots = caster.spell_slots || {};
  const slotKey = String(spell.level);
  const slot = slots[slotKey];
  if (!slot || (slot.used ?? 0) >= (slot.total ?? 0)) {
    ui._toast?.(`No level ${spell.level} slots remaining.`, 'error');
    return;
  }
  const next = { ...caster, spell_slots: { ...slots, [slotKey]: { ...slot, used: (slot.used ?? 0) + 1 } } };
  await ui.state.updateCharacter?.(caster.id, next);
  ui._log?.('🪄', `${esc(String(caster.name))} casts <b>${esc(String(spell.name))}</b> (level ${spell.level} slot)`);
  _fireSpellEffects(ui, spell, caster);
}

/**
 * One-click spell effects: roll structured damage and announce save
 * DC when the spell declares those fields. Called by _castSpell after
 * the slot deduction succeeds, so it fires for cantrips AND leveled
 * casts. Leaves spells without `damage` / `save_ability` untouched
 * (utility spells like Misty Step).
 */
function _fireSpellEffects(ui, spell, caster) {
  if (spell?.damage) {
    const dtype = spell.damage_type ? ` (${spell.damage_type})` : '';
    fireFormulaRoll(ui, spell.damage, `${spell.name ?? 'spell'} damage${dtype}`);
  }
  if (spell?.save_ability) {
    _announceSpellSave(ui, spell, caster?.id);
  }
}

function _announceSpellSave(ui, spell, casterId) {
  const caster = casterId ? ui.state.characters?.get?.(casterId) : ui.state.getCurrentCharacter?.();
  const dc = caster?.spell_save_dc;
  const ability = String(spell.save_ability || '').toUpperCase();
  const dcText = dc ? ` DC ${dc}` : '';
  ui._log?.('🛡', `<b>${esc(String(spell.name ?? 'Spell'))}</b> - ${ability} save${dcText}`);
}

async function _consumeItem(ui, itemId) {
  const item = ui.state.items?.get?.(itemId);
  if (!item) return;
  const nextQty = Math.max(0, (item.quantity ?? 1) - 1);
  await ui.state.updateItem?.(itemId, { ...item, quantity: nextQty });
  ui._log?.('🧪', `Used <b>${esc(String(item.name ?? 'item'))}</b>${nextQty === 0 ? ' (last one)' : ` - ${nextQty} left`}`);
}
