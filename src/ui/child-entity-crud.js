/**
 * child-entity-crud.js - shared CRUD helpers for child-entity tabs (Items,
 * Spells, Skills, Handouts, Tables). The tab describes *what* to
 * save; this file handles the send/try/catch/toast boilerplate.
 */

import { h } from 'preact';
import { confirm } from './confirm-dialogs.jsx';
import { VTTError, ErrorType, showErrorNotification } from '../utils/errorHandling.js';
import { EVENT_TYPES } from '../utils/constants.js';

/**
 * Persist a mutated character record. Signals publish on write, so
 * subscribers rerender automatically. Returns true on success, false
 * on send failure.
 */
export async function saveCharacterField(ui, charId, updated, errorMsg) {
  try {
    await ui.state.updateCharacter(charId, updated);
  } catch (error) {
    showErrorNotification(new VTTError(ErrorType.STATE_WRITE, errorMsg, error));
    return false;
  }
  return true;
}

const _CHILD_WRITERS = {
  [EVENT_TYPES.ITEM]:    (sm, id, e) => sm.updateItem(id, e),
  [EVENT_TYPES.SPELL]:   (sm, id, e) => sm.updateSpell(id, e),
  [EVENT_TYPES.HANDOUT]: (sm, id, e) => sm.updateHandout(id, e),
  [EVENT_TYPES.TABLE]:   (sm, id, e) => sm.updateTable(id, e),
  [EVENT_TYPES.TOKEN]:   (sm, id, e) => sm.updateToken(id, e),
  [EVENT_TYPES.CHARACTER]: (sm, id, e) => sm.updateCharacter(id, e),
  [EVENT_TYPES.NPC]:     (sm, id, e) => sm.updateNPC(id, e),
};

const _CHILD_REMOVERS = {
  [EVENT_TYPES.ITEM]:    (sm, id) => sm.removeItem(id),
  [EVENT_TYPES.SPELL]:   (sm, id) => sm.removeSpell(id),
  [EVENT_TYPES.HANDOUT]: (sm, id) => sm.removeHandout(id),
  [EVENT_TYPES.TABLE]:   (sm, id) => sm.removeTable(id),
  [EVENT_TYPES.TOKEN]:   (sm, id) => sm.updateToken(id, {}),
  [EVENT_TYPES.CHARACTER]: (sm, id) => sm.removeCharacter(id),
  [EVENT_TYPES.NPC]:     (sm, id) => sm.removeNPC(id),
};

/**
 * Persist a child entity and optionally update the owning character to
 * cross-reference it. On failure, shows a toast and returns false - the
 * caller's local state mutation was already applied, but the send failed.
 *
 * @param {Object} ui
 * @param {Object} opts
 * @param {string} opts.eventType        e.g. EVENT_TYPES.ITEM
 * @param {string} opts.id               entity id
 * @param {Object} opts.entity           entity content
 * @param {string} opts.noun             'item' | 'spell' | … (error copy)
 * @param {string} opts.verb             'create' | 'update' | 'save'
 * @param {{charId?: string, updated?: Object}} [opts.parentUpdate]
 *        optional character record to persist alongside the child write
 */
export async function saveChildEntity(ui, {
  eventType, id, entity, noun, verb,
  parentUpdate = null,
}) {
  const writer = _CHILD_WRITERS[eventType];
  if (!writer) {
    // Surfaced as a clear error naming the eventType - otherwise a typo
    // / new EVENT_TYPE without a writer here would silently throw
    // `TypeError: writer is not a function` and the catch below would
    // hide it behind a generic STATE_WRITE toast.
    showErrorNotification(new VTTError(
      ErrorType.STATE_WRITE,
      `No child-entity writer registered for ${eventType}`,
    ));
    return false;
  }
  try {
    if (parentUpdate?.charId && parentUpdate.updated) {
      await ui.state.updateCharacter(parentUpdate.charId, parentUpdate.updated);
    }
    await writer(ui.state, id, entity);
  } catch (error) {
    showErrorNotification(new VTTError(ErrorType.STATE_WRITE, `Failed to ${verb} ${noun}`, error));
    return false;
  }
  return true;
}

/**
 * Confirm + delete a child entity with the usual "are you sure" modal and
 * the same error/dispatch handling as saveChildEntity.
 *
 * parentLinkField: optional character field listing the child ids
 * (e.g. 'inventory_ids'); when present, the character record is rewritten
 * minus the deleted id.
 */
export function confirmDeleteChildEntity(ui, {
  eventType, id, noun, entityName, parentLinkField = null,
}) {
  confirm(
    h('span', null, ['Delete ', h('strong', null, entityName || `this ${noun}`), '? This cannot be undone.']),
    async () => {
      const character = ui.state.getCurrentCharacter();
      const charId = ui.state.getCurrentCharacterId();
      let updatedChar = null;
      if (parentLinkField && character && charId) {
        updatedChar = {
          ...character,
          [parentLinkField]: (character[parentLinkField] ?? []).filter((x) => x !== id),
        };
      }
      const remover = _CHILD_REMOVERS[eventType];
      if (!remover) {
        showErrorNotification(new VTTError(
          ErrorType.STATE_WRITE,
          `No child-entity remover registered for ${eventType}`,
        ));
        return;
      }
      try {
        if (updatedChar) {
          await ui.state.updateCharacter(charId, updatedChar);
        }
        await remover(ui.state, id);
      } catch (error) {
        showErrorNotification(new VTTError(ErrorType.STATE_WRITE, `Failed to delete ${noun}`, error));
      }
    },
    { title: `Delete ${noun[0].toUpperCase() + noun.slice(1)}`, confirmText: 'Delete', confirmClass: 'dbt--danger' }
  );
}
