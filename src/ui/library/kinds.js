/**
 * Per-kind library insert configuration. Each kind clones the stored entry
 * into the current campaign, reusing the existing entity writers, id
 * collision handling, and ruleset/map paths so the standard error toasts
 * and cross-references apply.
 */

import { EVENT_TYPES, LIBRARY_KIND } from '../../utils/constants.js';
import { saveChildEntity } from '../child-entity-crud.js';
import { resolveEntryId } from '../compendium/browse-helpers.js';
import { applyRulesetConfig } from '../ruleset-io.js';

function summaryOf(entry) {
  return entry?.data?.notes ? String(entry.data.notes).slice(0, 80) : '';
}

async function insertSheet(ui, entry, { collection, eventType, noun }) {
  const id = resolveEntryId(entry.id, ui.state[collection]);
  const entity = { ...entry.data, id };
  return saveChildEntity(ui, { eventType, id, entity, noun, verb: 'create' });
}

export const LIBRARY_KINDS = {
  [LIBRARY_KIND.CHARACTER]: {
    noun: 'character',
    summary: summaryOf,
    insert: (ui, entry) =>
      insertSheet(ui, entry, { collection: 'characters', eventType: EVENT_TYPES.CHARACTER, noun: 'character' }),
  },

  [LIBRARY_KIND.NPC]: {
    noun: 'NPC',
    summary: summaryOf,
    insert: (ui, entry) =>
      insertSheet(ui, entry, { collection: 'npcs', eventType: EVENT_TYPES.NPC, noun: 'NPC' }),
  },

  [LIBRARY_KIND.ITEM]: {
    noun: 'item',
    summary: summaryOf,
    async insert(ui, entry) {
      const id = resolveEntryId(entry.id, ui.state.items);
      const item = { ...entry.data, id };
      if (ui.state.isGM()) {
        return saveChildEntity(ui, { eventType: EVENT_TYPES.ITEM, id, entity: item, noun: 'item', verb: 'create' });
      }
      const character = ui.state.getCurrentCharacter();
      if (!character) {
        ui._toast('Select a character before adding items', 'info');
        return false;
      }
      const charId = ui.state.getCurrentCharacterId();
      const updated = { ...character, inventory_ids: [...(character.inventory_ids ?? []), id] };
      return saveChildEntity(ui, {
        eventType: EVENT_TYPES.ITEM,
        id, entity: item, noun: 'item', verb: 'create',
        parentUpdate: { charId, updated },
      });
    },
  },

  [LIBRARY_KIND.SPELL]: {
    noun: 'spell',
    summary: summaryOf,
    async insert(ui, entry) {
      const character = ui.state.getCurrentCharacter();
      if (!character) {
        ui._toast('Select a character before adding spells', 'info');
        return false;
      }
      const id = resolveEntryId(entry.id, ui.state.spells);
      const spell = { ...entry.data, id, prepared: false };
      const charId = ui.state.getCurrentCharacterId();
      const updated = { ...character, spell_ids: [...(character.spell_ids ?? []), id] };
      return saveChildEntity(ui, {
        eventType: EVENT_TYPES.SPELL,
        id, entity: spell, noun: 'spell', verb: 'create',
        parentUpdate: { charId, updated },
      });
    },
  },

  [LIBRARY_KIND.MAP]: {
    noun: 'map',
    summary: summaryOf,
    async insert(ui, entry) {
      // eslint-disable-next-line no-unused-vars
      const { id, ...config } = entry.data;
      await ui.state.createMap(config);
      return true;
    },
  },

  [LIBRARY_KIND.RULESET]: {
    noun: 'ruleset',
    summary: (entry) => entry?.data?.system || '',
    insert(ui, entry) {
      const { system = 'custom', ...systemConfig } = entry.data;
      return applyRulesetConfig(ui, system, systemConfig);
    },
  },
};
