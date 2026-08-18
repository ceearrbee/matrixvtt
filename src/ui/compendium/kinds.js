/**
 * Per-kind compendium configuration: which collection the entry lands
 * in, how a row is summarised, the secondary filter, and the add flow.
 * Add flows clone the SRD entry, resolve id collisions, and persist
 * through saveChildEntity so the existing error-toast boilerplate and
 * character cross-referencing apply.
 */

import { EVENT_TYPES } from '../../utils/constants.js';
import { saveChildEntity } from '../child-entity-crud.js';
import {
  resolveEntryId,
  distinctSpellLevels,
  distinctMonsterCRs,
  distinctItemTypes,
  spellSummary,
  monsterSummary,
  itemSummary,
} from './browse-helpers.js';

export const COMPENDIUM_KINDS = {
  spell: {
    dataKey: 'spells',
    noun: 'spell',
    summary: spellSummary,
    facet: {
      label: 'Level',
      options: distinctSpellLevels,
      key: (entry) => entry.level,
    },
    async add(ui, entry) {
      const character = ui.state.getCurrentCharacter();
      if (!character) {
        ui._toast('Select a character before adding spells', 'info');
        return false;
      }
      const id = resolveEntryId(entry.id, ui.state.spells);
      const spell = { ...entry, id, prepared: false };
      const charId = ui.state.getCurrentCharacterId();
      const updated = { ...character, spell_ids: [...(character.spell_ids ?? []), id] };
      return saveChildEntity(ui, {
        eventType: EVENT_TYPES.SPELL,
        id, entity: spell, noun: 'spell', verb: 'create',
        parentUpdate: { charId, updated },
      });
    },
  },

  item: {
    dataKey: 'items',
    noun: 'item',
    summary: itemSummary,
    facet: {
      label: 'Type',
      options: distinctItemTypes,
      key: (entry) => entry.type,
    },
    async add(ui, entry) {
      const id = resolveEntryId(entry.id, ui.state.items);
      const item = { ...entry, id };
      // GMs stock the campaign with loose items; players add to their
      // own inventory, which needs a current character to link to.
      if (ui.state.isGM()) {
        return saveChildEntity(ui, {
          eventType: EVENT_TYPES.ITEM,
          id, entity: item, noun: 'item', verb: 'create',
        });
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

  monster: {
    dataKey: 'monsters',
    noun: 'monster',
    summary: monsterSummary,
    facet: {
      label: 'CR',
      options: distinctMonsterCRs,
      key: (entry) => entry.cr,
    },
    async add(ui, entry) {
      const id = resolveEntryId(entry.id, ui.state.npcs);
      const npc = { ...entry, id };
      return saveChildEntity(ui, {
        eventType: EVENT_TYPES.NPC,
        id, entity: npc, noun: 'monster', verb: 'create',
      });
    },
  },
};
