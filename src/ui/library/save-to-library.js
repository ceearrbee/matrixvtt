/**
 * Save an existing campaign entity (or the active ruleset) into the user's
 * personal library. Standalone-only; a no-op when the library is hidden.
 * For rulesets pass `{ system, systemConfig }` as the third argument so the
 * entry stores the slug alongside the config, matching the insert flow.
 */

import { LibraryManager } from '../../library/LibraryManager.js';
import { LIBRARY_KIND } from '../../utils/constants.js';
import { libraryAvailable } from './availability.js';

export { libraryAvailable };

export async function saveToLibrary(ui, kind, entity, ruleset = null) {
  if (!libraryAvailable(ui)) return;

  const name = (entity?.name || '').trim() || `Untitled ${kind}`;
  const data = kind === LIBRARY_KIND.RULESET && ruleset
    ? { system: ruleset.system || 'custom', ...ruleset.systemConfig }
    : entity;

  try {
    const manager = new LibraryManager(ui.widgetManager.getMatrixClient());
    await manager.saveEntry({ kind, name, data });
    ui._toast?.(`"${name}" saved to your library`, 'success');
  } catch (err) {
    ui._toast?.(`Could not save to library: ${err.message}`, 'error');
  }
}
