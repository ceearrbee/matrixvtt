/**
 * entity-ops.js - single-entity GM-or-player actions: long rest,
 * XP / level-up, and HP delta / set-HP. `_resolveEntity` unifies the
 * char-vs-NPC branch that HP helpers share.
 */

import { VTTError, ErrorType, showErrorNotification } from '../../utils/errorHandling.js';
import { EVENT_TYPES, ENTITY_TYPES } from '../../utils/constants.js';
import { levelFromXp, nextLevelThreshold } from '../../engine/progression.js';

export async function applyLongRest(ui) {
  const character = ui.state.getCurrentCharacter();
  if (!character) return;

  const charId = ui.state.getCurrentCharacterId();
  const restoredSlots = {};
  for (const [level, slot] of Object.entries(character.spell_slots ?? {})) {
    restoredSlots[level] = { ...slot, used: 0 };
  }

  const updated = {
    ...character,
    hp_current: character.hp_max ?? character.hp_current,
    spell_slots: restoredSlots,
  };

  try {
    await ui.state.updateCharacter(charId, updated);
  } catch (error) {
    showErrorNotification(new VTTError(ErrorType.STATE_WRITE, 'Long rest failed to save', error));
    return;
  }

  ui._log('😴', `${character.name} takes a long rest - HP and spell slots restored`);
}

export async function adjustXP(ui, charId, amount) {
  if (!ui.state.isGM()) {
    ui._toast('XP can be awarded by GMs only. Ask a GM in this room.');
    return;
  }

  const character = ui.state.characters.get(charId);
  if (!character) return;

  const newXP = Math.max(0, (character.xp_current || 0) + amount);
  const updated = { ...character, xp_current: newXP };

  // Level-up logic is ruleset-driven: only fires when the active
  // systemConfig declares a `progression` block (see src/engine/progression.js).
  // Rulesets without leveling simply leave XP alone.
  const ruleset = ui.state.settings?.systemConfig;
  const newLevel = levelFromXp(ruleset, newXP);
  if (newLevel !== null && amount > 0) {
    const currentLevel = character.level || 1;
    if (newLevel > currentLevel) {
      updated.level = newLevel;
      const next = nextLevelThreshold(ruleset, newLevel);
      if (next !== null) updated.xp_next_level = next;
      ui._toast(`${character.name} leveled up to level ${newLevel}!`, 'success');
    }
  }

  try {
    await ui.state.updateCharacter(charId, updated);
  } catch (error) {
    showErrorNotification(new VTTError(ErrorType.STATE_WRITE, 'Failed to save XP', error));
  }
}

// Look up a character or NPC by id + type kind, paired with the
// facade write function used to persist mutations. Factoring keeps
// the two maps in sync if either ever gains a new kind.
function _resolveEntity(ui, entityId, entityType) {
  const isNPC = entityType === ENTITY_TYPES.NPC;
  const entity = isNPC ? ui.state.npcs.get(entityId) : ui.state.characters.get(entityId);
  const write = isNPC
    ? (id, v) => ui.state.updateNPC(id, v)
    : (id, v) => ui.state.updateCharacter(id, v);
  const eventType = isNPC ? EVENT_TYPES.NPC : EVENT_TYPES.CHARACTER;
  return { entity, isNPC, eventType, write };
}

export async function adjustTokenHP(ui, tokenId, amount) {
  const token = ui.state.tokens.get(tokenId);
  if (!token?.sheet_id) return;
  const isNPC = ui.state.npcs.has(token.sheet_id);
  const entityType = isNPC ? ENTITY_TYPES.NPC : 'character';
  await adjustHP(ui, token.sheet_id, amount, entityType);
}

export async function adjustHP(ui, entityId, amount, entityType = 'character') {
  const { entity, isNPC, write } = _resolveEntity(ui, entityId, entityType);
  if (!entity) return;

  if (isNPC) {
    if (!ui.state.isGM()) { ui._toast('NPC hit points can be changed by GMs only.'); return; }
  } else {
    if (!ui.state.canEditEntity(entity)) { ui._toast("Only this character's player or a GM can edit it."); return; }
  }

  const updated = {
    ...entity,
    hp_current: Math.max(0, Math.min(entity.hp_max, entity.hp_current + amount)),
  };
  await write(entityId, updated);
}

export function setHP(ui, entityId, newHp, entityType = 'character') {
  const { entity, eventType } = _resolveEntity(ui, entityId, entityType);
  if (!entity) return;
  const updated = {
    ...entity,
    hp_current: Math.max(0, Math.min(parseInt(newHp) || 0, entity.hp_max)),
  };
  // Interactive HP edits: update Map + signal now, debounce the
  // network write so a dragged slider doesn't spam Matrix.
  ui.state.updateEntityDebounced(eventType, entityId, updated);
}
