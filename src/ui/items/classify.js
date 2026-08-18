/**
 * classifyItems - split every item in `ui.state.items` into one of
 * three buckets:
 *
 *   byCharacter: Map<item_id, { charId, charName }> - held in a PC's
 *                `inventory_ids` array. First holder wins (defensive
 *                against duplicate ownership).
 *   onMap:       Map<item_id, true>                - represented by a
 *                token of `type:'item'` carrying matching `item_id`.
 *   loose:       Set<item_id>                       - exists in the
 *                items pool but is neither held nor on the map.
 *
 * Pure function: no signals, no DOM, no side effects.
 */
export function classifyItems(ui) {
  const items = ui?.state?.items;
  const characters = ui?.state?.characters;
  const tokens = ui?.state?.tokens;

  const byCharacter = new Map();
  const onMap = new Map();
  const loose = new Set();
  if (!items) return { byCharacter, onMap, loose };

  // First pass: characters claim their items.
  if (characters) {
    for (const [charId, char] of characters) {
      const inv = Array.isArray(char?.inventory_ids) ? char.inventory_ids : [];
      for (const itemId of inv) {
        if (!byCharacter.has(itemId)) {
          byCharacter.set(itemId, { charId, charName: char?.name || charId });
        }
      }
    }
  }

  // Second pass: tokens with type:'item' that link back to an item id.
  if (tokens) {
    for (const token of tokens.values()) {
      if (token?.type !== 'item') continue;
      const id = token.item_id;
      if (!id) continue;
      if (byCharacter.has(id)) continue;
      onMap.set(id, true);
    }
  }

  // Third pass: every item that wasn't claimed is loose.
  for (const itemId of items.keys()) {
    if (byCharacter.has(itemId)) continue;
    if (onMap.has(itemId)) continue;
    loose.add(itemId);
  }

  return { byCharacter, onMap, loose };
}
