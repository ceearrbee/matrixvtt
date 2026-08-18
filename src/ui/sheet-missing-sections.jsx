/**
 * Shared warning surface for CharacterSheet / NPCSheet when the ruleset
 * is loaded but declares no `character_sheet.sections` / `npc_sheet.sections`.
 * Fail loud, not silent.
 */
import { h } from 'preact';
import { EmptyState } from './EmptyState.jsx';

export function SheetMissingSectionsWarning({ entityKind }) {
  const which = entityKind === 'npc'
    ? '`npc_sheet.sections` or `character_sheet.sections`'
    : '`character_sheet.sections`';
  return h(EmptyState, {
    glyph: '⚠',
    title: 'No sheet sections declared',
    body: `The active ruleset is loaded but defines no ${which} array. The body of this sheet is empty - check the ruleset configuration.`,
  });
}
