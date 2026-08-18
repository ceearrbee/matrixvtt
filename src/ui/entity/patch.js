/**
 * patch.js - inline sheet-edit write path. Sections patch a few fields
 * at a time (a cliché slot, a stress box, a resource pool); the state
 * writer replaces records wholesale, so the patch merges over the
 * stored entity first. Routes PC vs NPC by collection so the same
 * sections work on both sheets.
 */

// Record-shaped fields (cliché slots, box tracks) merge one level deep
// so a patch carrying one key can't wipe its siblings; arrays and
// scalars replace wholesale.
function merge(existing, patch) {
  const next = { ...existing, ...patch };
  for (const [key, value] of Object.entries(patch)) {
    const prev = existing?.[key];
    const bothRecords =
      value && prev && typeof value === 'object' && typeof prev === 'object' &&
      !Array.isArray(value) && !Array.isArray(prev);
    if (bothRecords) next[key] = { ...prev, ...value };
  }
  return next;
}

export async function patchEntity(ui, id, patch) {
  const character = ui.state.characters.get(id);
  if (character) return ui.state.updateCharacter(id, merge(character, patch));
  const npc = ui.state.npcs.get(id);
  if (npc) return ui.state.updateNPC(id, merge(npc, patch));
}
