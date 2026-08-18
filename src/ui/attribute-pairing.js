/**
 * attribute-pairing.js - slot_list ↔ attributes key pairing.
 *
 * Some systems name their attribute slots per character: Risus pairs
 * the `cliches` slot_list with the cliché-dice attributes through
 * shared keys (cliche1..cliche6). When a ruleset declares such a
 * pairing, the attribute cards carry the character's own names and
 * the rolls announce them ("Swashbuckler check", not "Cliché 1 dice
 * check"). The same convention drives the character_card text overlay.
 */

export function pairedSlotSection(systemConfig) {
  const attrs = systemConfig?.attributes;
  if (!Array.isArray(attrs) || attrs.length === 0) return null;
  const keys = new Set(attrs.map((a) => a.key));
  for (const section of systemConfig.character_sheet?.sections ?? []) {
    if (section.kind !== 'slot_list' || !Array.isArray(section.slots)) continue;
    if (section.slots.some((slot) => keys.has(slot.key))) return section;
  }
  return null;
}

export function pairedSlotField(systemConfig) {
  return pairedSlotSection(systemConfig)?.field ?? null;
}
