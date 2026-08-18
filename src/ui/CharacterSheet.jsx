/**
 * CharacterSheet.jsx - PC sheet tab. Header + ownership controls are
 * fixed; the body is composed from `ruleset.character_sheet.sections[]`
 * via the section dispatcher.
 */

import { h } from 'preact';
import { EditIcon, MapsIcon, SheetIcon, PersonIcon } from './icons/index.jsx';
import { charactersSignal, tokensSignal, settingsSignal } from '../state/signals.js';
import { selectedCharacterIdSignal, selectedTokenSignal, tablePhaseSignal } from '../state/ui-signals.js';
import { renderSectionList, renderPrivateNotesSection } from './characterSheetSections.js';
import { ENTITY_TYPES, LIBRARY_KIND } from '../utils/constants.js';
import { CharacterSwitcher } from './CharacterSwitcher.jsx';
import { SheetHeader } from './SheetHeader.jsx';
import { EntityList } from './EntityList.jsx';
import { SheetMissingSectionsWarning } from './sheet-missing-sections.jsx';
import { SaveToLibraryButton } from './library/SaveToLibraryButton.jsx';

function Ownership({ ui, character, isGM, myUserId }) {
  const mine = character.player_user_id === myUserId || character.claimed_by_user_id === myUserId;
  const claimed = character.player_user_id || character.claimed_by_user_id;
  if ((mine || isGM) && claimed) {
    return h('div', { class: 'section-header' }, [
      mine ? 'Your Character' : `Claimed By ${claimed}`,
      h('button', {
        class: 'dbt dbt--sm', style: 'float:right;font-size:10px;',
        'aria-label': 'Release character', title: 'Release character ownership',
        onClick: () => ui.unclaimCharacter(character.id),
      }, 'Release'),
    ]);
  }
  if (claimed) {
    return h('div', { style: 'display:contents' }, [
      h('div', { class: 'section-header' }, 'Claimed By'),
      h('div', { class: 'entity-subtitle' }, claimed),
    ]);
  }
  return h('div', { style: 'margin-top: 12px;' },
    h('button', {
      class: 'dbt btn-primary', style: 'width: 100%;',
      'aria-label': 'Claim this character', title: 'Claim character to take ownership',
      onClick: () => ui.claimCharacter(character.id),
    }, [h(PersonIcon, {}), ' Claim This Character']));
}

export function CharacterSheet({ ui }) {
  // Read signals so @preact/signals auto-subscribes this component to
  // character / token / selection / settings changes; any subsequent
  // write to those signals (directly or via the Yjs bridge) triggers a
  // rerender. settingsSignal is dereferenced explicitly so a future
  // refactor of `ui.state.settings` to a non-getter doesn't silently
  // break section rerenders when a ruleset arrives post-mount.
  // tablePhaseSignal must be dereferenced HERE - renderSectionList reads it
  // internally to decide section layout by phase, but that's a non-component
  // helper so its read doesn't subscribe us.
  // Without this line, a phase change updates the signal but the sheet
  // stays in the prior layout.
  charactersSignal.value; tokensSignal.value; selectedCharacterIdSignal.value; selectedTokenSignal.value; settingsSignal.value; tablePhaseSignal.value;
  const character = ui.state.getCurrentCharacter();
  const isGM = ui.state.isGM();
  const myUserId = ui.widgetManager?.userId;

  if (!character) {
    return h('div', { class: 'char-sheet-empty' }, [
      h(CharacterSwitcher, { ui }),
      h(EntityList, { ui, type: ENTITY_TYPES.PC }),
    ]);
  }

  const canEdit = ui.state.canEditEntity(character);
  const systemConfig = ui.state.settings?.systemConfig;
  const rulesetLoaded = !!systemConfig && Object.keys(systemConfig).length > 0;
  const sectionsRaw = systemConfig?.character_sheet?.sections;
  const sections = Array.isArray(sectionsRaw) ? sectionsRaw : [];
  const showMissingWarning = rulesetLoaded && sections.length === 0;

  return h('div', { class: 'char-sheet', 'data-entity-id': character.id }, [
    h(CharacterSwitcher, { ui }),
    h(SheetHeader, {
      variant: 'pc',
      name: character.name,
      subtitle: `${character.class_level ?? ''} · ${character.species ?? ''}`,
      imageUrl: character.image_url,
      actions: [
        canEdit && h('button', {
          class: 'dbt dbt--sm', 'aria-label': 'Edit character', title: 'Edit character',
          onClick: () => ui.showEditCharacterForm(character.id),
        }, [h(EditIcon, {}), ' Edit']),
        canEdit && h('button', {
          class: 'dbt dbt--sm', 'aria-label': 'Save as template', title: 'Save as character template',
          onClick: () => ui.saveCharacterAsTemplate(character.id),
        }, h(SheetIcon, {})),
        isGM && !ui.state.hasTokenForSheet(character.id) && h('button', {
          class: 'dbt dbt--sm', 'aria-label': 'Place on map', title: 'Place token on map',
          onClick: () => ui.placeSheetOnMap(character.id, ENTITY_TYPES.PC),
        }, [h(MapsIcon, {}), ' Place']),
        canEdit && h(SaveToLibraryButton, {
          ui, kind: LIBRARY_KIND.CHARACTER, entity: character, compact: false, label: '📥 Library',
        }),
      ],
    }),
    showMissingWarning && h(SheetMissingSectionsWarning, { entityKind: 'pc' }),
    ...renderSectionList(ui, character, sections),
    renderPrivateNotesSection(ui, character),
    h(Ownership, { ui, character, isGM, myUserId }),
  ]);
}
