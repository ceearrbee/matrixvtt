/**
 * preview-token.js - token-level "view this token's entity" entry point.
 *
 * The map's "View Sheet" context-menu action, the token action bar, the
 * command palette, the initiative row, and double-clicking a token all
 * want to "show this entity." PC and NPC entities have a canonical home -
 * the sidebar sheet - so we select them there instead of opening a popup
 * that duplicates the sidebar. Item tokens have no sidebar sheet, so they
 * keep the item preview popup.
 *
 * Routes by token kind:
 *   - type:'item' with a resolvable `item_id` → item preview popup.
 *   - sheet_id resolves to a PC → select into the sidebar Sheet tab.
 *   - sheet_id resolves to an NPC → select into the sidebar NPC tab.
 *   - anything else → toast so the click isn't silently swallowed.
 *
 * Preserves `state.selectedToken` so the map's selection ring stays in
 * sync (selectCharacterById / selectNPCById re-affirm it via the token).
 */

export function previewToken(ui, tokenId) {
  const token = ui.state?.tokens?.get?.(tokenId);
  if (!token) return;
  ui.state.selectedToken = tokenId;

  // Item-token back-link via item_id, populated by `spawnItemToken`.
  if (token.type === 'item' && token.item_id && ui.state.items?.has?.(token.item_id)) {
    ui.showItemPreview?.(token.item_id);
    return;
  }

  if (token.sheet_id) {
    if (ui.state.characters?.has?.(token.sheet_id)) {
      ui.selectCharacterById?.(token.sheet_id);
      return;
    }
    if (ui.state.npcs?.has?.(token.sheet_id)) {
      ui.selectNPCById?.(token.sheet_id);
      return;
    }
  }

  ui._toast?.('No sheet linked to this token', 'info');
}
