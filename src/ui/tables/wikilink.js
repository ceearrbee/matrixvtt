/**
 * dispatchRollWikilink - handles a click on a `[[roll:<id>]]` wikilink.
 * Lifted out of `showHandoutModal`'s click handler so the tables domain
 * owns its own wikilink dispatch.
 *
 * `link` is the `<a>` element (already matched by class + data attr).
 * Returns true if the click was consumed.
 */
export function dispatchRollWikilink(ui, link) {
  const tableId = link.getAttribute('data-roll-table');
  if (!tableId) return false;
  ui.rollTable?.(tableId);
  return true;
}
