/**
 * system-fields.js - which classic stat inputs a ruleset actually has.
 * Token and NPC forms hardcode HP/AC/Speed inputs from the d20 days;
 * these predicates gate them on the active ruleset. No config loaded
 * means legacy behavior (show everything).
 */

export function rulesetTracksHP(systemConfig) {
  const hm = systemConfig?.harm_model;
  if (!hm) return true;
  if (hm.type === 'pool') return (hm.track_key ?? 'hp') === 'hp';
  if (hm.type === 'tracks') return Array.isArray(hm.tracks) && hm.tracks.includes('hp');
  return false;
}

export function rulesetHasFormField(systemConfig, id) {
  if (!systemConfig) return true;
  const fields = systemConfig.character_form?.fields ?? [];
  const ids = [];
  for (const f of fields) {
    if (f?.id) ids.push(f.id);
    for (const sub of f?.fields ?? []) if (sub?.id) ids.push(sub.id);
  }
  return ids.includes(id);
}
