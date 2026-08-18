/**
 * sheet-renderers.js - entity-form helpers.
 *
 * The legacy string-HTML renderers (`renderCharacterList`, `renderNPCList`,
 * `renderCharacterSwitcher`, `renderEntityCard`, `renderNPCSheet`,
 * `renderDynamicAttributes`, `renderAttribute`, `renderAttributeInputs`,
 * `setupSheetListHandlers`) were deleted after the live Preact tree was
 * migrated to `CharacterSheet.jsx` / `NPCSheet.jsx` / `EntityList.jsx` /
 * `CharacterSwitcher.jsx` / `DynamicAttributes.jsx` / `AttributeInputs.jsx`.
 *
 * What survives here: the two pure DOM-read helpers invoked by the form
 * submit path in entity-manager.js. They read values from an already-open
 * modal; they don't render.
 */

export function collectSpellSlots(ui, modal) {
  const slots = {};
  for (let lvl = 1; lvl <= 9; lvl++) {
    const input = modal.querySelector(`#entity-spell-slots-${lvl}`);
    const total = parseInt(input?.value) || 0;
    if (total > 0) {
      const existing = ui.state.getCurrentCharacter()?.spell_slots?.[String(lvl)];
      slots[String(lvl)] = { total, used: existing?.used ?? 0 };
    }
  }
  return slots;
}

export function collectAttributeValues(ui, modal) {
  const attrs = {};
  modal.querySelectorAll('.entity-attr[data-attr-key]').forEach(input => {
    attrs[input.dataset.attrKey] = parseInt(input.value) || 0;
  });
  return attrs;
}
