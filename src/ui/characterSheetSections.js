/**
 * Section dispatcher for `character_sheet.sections[]` and
 * `npc_sheet.sections[]`. To add a kind: write a component (in the
 * appropriate `./character-sheet-sections/*` module), register it in
 * `KINDS`, document the config shape in RULESET-SPEC.md.
 *
 * Component groupings:
 *   - `./character-sheet-sections/display.js`   - basic readouts
 *   - `./character-sheet-sections/narrative.js` - interactive primitives
 *   - `./character-sheet-sections/lists.js`     - larger list/action surfaces
 */

import { h } from 'preact';
import { dispatchSections } from './section-dispatcher.js';
import { getPrivateNote, setPrivateNote } from '../utils/private-notes.js';
import {
  ResourceTrack, StatGrid, Attributes, Saves, Conditions, Defenses, Notes,
  StressBoxes, Aspects, Wounds, Personality,
} from './character-sheet-sections/display.js';
import {
  TaggedList, SlotList, BoxTrack, ResourcePool, ButtonAction, PendingModifiersList,
} from './character-sheet-sections/narrative.js';
import {
  SkillList, Currency, InventorySummary, SpellBook, PlayActions, ActionList,
} from './character-sheet-sections/lists.js';

const KINDS = {
  resource_track:  ResourceTrack,
  stat_grid:       StatGrid,
  attributes:      Attributes,
  saves:           Saves,
  conditions:      Conditions,
  defenses:        Defenses,
  notes:           Notes,
  stress_boxes:    StressBoxes,
  // Deprecated alias - kept for back-compat. New rulesets should use
  // `tagged_list` with `{ field: 'aspects', label: 'Aspects' }`.
  aspects:         Aspects,
  wounds:          Wounds,
  // Generic narrative primitives - see RULESET-SPEC.md §section-kinds.
  tagged_list:     TaggedList,
  slot_list:       SlotList,
  box_track:       BoxTrack,
  resource_pool:   ResourcePool,
  button_action:   ButtonAction,
  pending_modifiers_list: PendingModifiersList,
  skill_list:      SkillList,
  currency:        Currency,
  personality:     Personality,
  inventory_summary: InventorySummary,
  spell_book:      SpellBook,
  play_actions:    PlayActions,
  // `actions` is the legacy name that implied field='actions'.
  // `action_list` is the generic form; both share the same component.
  actions:         ActionList,
  action_list:     ActionList,
  private_notes:   PrivateNotes,
};

// Test-only re-export so spec files can render a single primitive
// without going through the full sheet dispatcher. Not part of the
// public surface - do not import from production code.
export const _kindsForTest = KINDS;

/**
 * Per-user private notes for the entity being viewed. Backed by
 * localStorage (truly private; never synced to Matrix). Renders an
 * editable textarea that saves on blur. Section header is always
 * visible - the textarea is empty for entities the user hasn't
 * annotated yet, which is the empty-state cue.
 */
function PrivateNotes({ ui, character }) {
  const userId = ui.state?.widgetManager?.userId
    || ui.widgetManager?.userId
    || ui.clientManager?.userId
    || null;
  const roomId = ui.widgetManager?.roomId
    || ui.clientManager?.roomId
    || ui.state?.roomId
    || null;
  const entityId = character?.id;
  const initial = (userId && roomId && entityId)
    ? getPrivateNote(userId, roomId, entityId)
    : '';
  const onBlur = (e) => {
    if (!userId || !roomId || !entityId) return;
    setPrivateNote(userId, roomId, entityId, e.target.value);
  };
  return h('div', { style: 'display:contents' }, [
    h('div', { class: 'section-header' }, '🔒 Your private notes'),
    h('textarea', {
      class: 'form-input',
      style: 'width:100%; min-height: 60px; resize: vertical; font-family: var(--font-sans); font-size: var(--font-size-sm);',
      placeholder: 'Just for you. Stored locally, never sent to other players or the server.',
      defaultValue: initial,
      onBlur,
      'aria-label': 'Private notes (local only)',
    }),
  ]);
}

// Sections flagged `collapsed` in the ruleset (low-frequency reference
// blocks like coinage / personality / notes) render inside a native
// <details> so the sheet leads with what a GM touches during play. The
// section renders its own `.section-header` inside; CSS hides that inner
// header so the <summary> is the single visible label.
function decorateSection(vnode, cfg, i) {
  if (!cfg?.collapsed) return vnode;
  return h('details', { key: i, class: 'sheet-section-collapsible' }, [
    h('summary', { class: 'section-header' }, cfg.label ?? cfg.title ?? cfg.kind),
    vnode,
  ]);
}

export function renderSectionList(ui, character, sections) {
  return dispatchSections(
    KINDS,
    sections,
    (config, i) => ({ key: i, ui, character, config }),
    decorateSection
  );
}

/**
 * Per-character private notes - rendered once per sheet by callers
 * that opt in. Kept separate from renderSectionList so the existing
 * "empty input → empty output" contract stays intact for ruleset
 * tests; the sheet renderer composes both as needed.
 */
export function renderPrivateNotesSection(ui, character) {
  if (!character?.id) return null;
  return h(PrivateNotes, { key: '__private_notes', ui, character });
}
