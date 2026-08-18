/**
 * Small gated button that saves an entity (or the active ruleset) to the
 * personal library. Renders nothing in widget mode or when the library is
 * otherwise unavailable, so callers can drop it into any action row.
 */

import { h } from 'preact';
import { libraryAvailable, saveToLibrary } from './save-to-library.js';

export function SaveToLibraryButton({ ui, kind, entity, ruleset = null, label = null, compact = true }) {
  if (!libraryAvailable(ui)) return null;
  const name = entity?.name || (kind === 'ruleset' ? 'ruleset' : kind);
  return h('button', {
    type: 'button',
    class: compact ? 'dbt dbt--compact' : 'dbt dbt--sm',
    'data-save-to-library': kind,
    'aria-label': `Save ${name} to your library`,
    title: 'Save to library',
    onClick: (e) => {
      e.stopPropagation();
      saveToLibrary(ui, kind, entity, ruleset);
    },
  }, label ?? '📥');
}
