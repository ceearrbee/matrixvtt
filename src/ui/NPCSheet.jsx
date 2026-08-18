/**
 * NPCSheet.jsx - NPC tab. Shows selected NPC sheet or list of NPCs.
 *
 * Body sections come from `ruleset.npc_sheet.sections` via the section
 * dispatcher (same one the PC sheet uses). Header metadata (CR, size,
 * creature type) only renders when the NPC actually has those fields.
 */

import { h } from 'preact';
import { EditIcon, MapsIcon } from './icons/index.jsx';
import { npcsSignal, tokensSignal, settingsSignal, roomMembersSignal } from '../state/signals.js';
import { selectedNPCIdSignal, selectedTokenSignal, tablePhaseSignal } from '../state/ui-signals.js';
import { renderSectionList, renderPrivateNotesSection } from './characterSheetSections.js';
import { ENTITY_TYPES, LIBRARY_KIND } from '../utils/constants.js';
import { SheetHeader } from './SheetHeader.jsx';
import { EntityList } from './EntityList.jsx';
import { SheetMissingSectionsWarning } from './sheet-missing-sections.jsx';
import { SaveToLibraryButton } from './library/SaveToLibraryButton.jsx';

export function NPCSheet({ ui }) {
  // Auto-subscribe to NPC + token + selection + settings signals.
  // Explicit settingsSignal read keeps section rerenders robust against
  // a future refactor of `ui.state.settings` away from the getter path.
  // tablePhaseSignal must be dereferenced here - renderSectionList reads it
  // internally to switch section layout by phase, but that's a non-component
  // helper whose read does not subscribe us.
  npcsSignal.value; tokensSignal.value; selectedNPCIdSignal.value; selectedTokenSignal.value; settingsSignal.value; tablePhaseSignal.value; roomMembersSignal.value;
  const npcId = ui.state.selectedNPCId;
  const npc = npcId ? ui.state.npcs.get(npcId) : null;

  if (!npc) {
    return h(EntityList, { ui, type: ENTITY_TYPES.NPC });
  }

  const isGM = ui.state.isGM();
  const ruleset = ui.state.settings.systemConfig;
  const rulesetLoaded = !!ruleset && Object.keys(ruleset).length > 0;
  const sectionsRaw = ruleset?.npc_sheet?.sections ?? ruleset?.character_sheet?.sections;
  const sections = Array.isArray(sectionsRaw) ? sectionsRaw : [];
  const showMissingWarning = rulesetLoaded && sections.length === 0;
  const meta = [
    npc.cr != null ? `CR ${npc.cr}` : null,
    npc.size_category,
    npc.creature_type,
  ].filter(Boolean).join(' · ');

  return h('div', { class: 'npc-sheet', 'data-entity-id': npc.id }, [
    h(SheetHeader, {
      variant: 'npc',
      name: npc.name,
      subtitle: meta || null,
      imageUrl: npc.image_url,
      onBack: () => ui.clearSelectedNPC(),
      actions: [
        isGM && h('button', {
          class: 'dbt dbt--sm',
          'aria-label': 'Edit NPC', title: 'Edit NPC',
          onClick: () => ui.showEntityForm(ENTITY_TYPES.NPC, npc.id),
        }, h(EditIcon, {})),
        h('button', {
          class: 'dbt dbt--sm', title: 'Place on map', 'aria-label': 'Place on map',
          onClick: () => ui.placeSheetOnMap(npc.id, ENTITY_TYPES.NPC),
        }, [h(MapsIcon, {}), ' Place']),
        isGM && h(SaveToLibraryButton, { ui, kind: LIBRARY_KIND.NPC, entity: npc }),
      ],
    }),
    isGM && h('div', { class: 'npc-control' }, [
      h('label', { class: 'npc-control__label', for: 'npc-control-select' }, 'Controlled by'),
      h('select', {
        id: 'npc-control-select',
        class: 'form-select npc-control__select',
        'data-npc-control': npc.id,
        value: npc.controlled_by ?? '',
        'aria-label': `Assign control of ${npc.name}`,
        onChange: (e) => {
          const v = e.target.value;
          if (v) ui.assignNPCController?.(npc.id, v);
          else ui.releaseNPCController?.(npc.id);
        },
      }, [
        h('option', { value: '' }, 'GM only'),
        ...(ui.state?.roomMembers ?? []).map((m) =>
          h('option', { key: m.userId, value: m.userId }, m.displayname || m.userId)),
      ]),
    ]),
    showMissingWarning && h(SheetMissingSectionsWarning, { entityKind: 'npc' }),
    ...renderSectionList(ui, npc, sections),
    renderPrivateNotesSection(ui, npc),
  ]);
}
