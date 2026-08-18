/**
 * dispatchMapWikilink - handles a click on a `[[map:<id>]]` wikilink.
 * Mirrors `dispatchRollWikilink` (src/ui/tables/wikilink.js): reads the
 * data attribute already resolved by `renderWikilinks` and forwards to
 * the existing `switchMap` writer, so map authoring never invents a
 * second map-switch pathway.
 *
 * `link` is the `<a>` element (already matched by class + data attr).
 * Returns true if the click was consumed.
 */
import { VTTError, ErrorType, showErrorNotification } from '../../utils/errorHandling.js';

export function dispatchMapWikilink(ui, link) {
  const mapId = link.getAttribute('data-map-id');
  if (!mapId) return false;
  ui.state.switchMap(mapId).catch((e) => {
    showErrorNotification(e instanceof VTTError ? e : new VTTError(ErrorType.STATE_WRITE, 'Failed to switch maps', e));
  });
  return true;
}
