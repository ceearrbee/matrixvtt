/**
 * Generic harm applier. The ruleset's `harm_model` tells us how to route
 * incoming damage; entity state holds the actual tracks/boxes/wounds.
 *
 *   pool    { type, track_key }                  entity.<track_key>: { current, max }
 *   tracks  { type, tracks: [key, ...] }        entity.<each key>:  { current }
 *   stress  { type, boxes: [capacities...] }    entity.stress: boolean[]
 *   wounds  { type, thresholds: [{tier, max}] } entity.wounds: [{tier, amount}, ...]
 *
 * Returns a new entity; never mutates.
 */

export function applyHarm(model, entity, amount, kind = null) {
  if (!model?.type || !Number.isFinite(amount) || amount <= 0) {
    return entity;
  }

  switch (model.type) {
    case 'pool': return applyPool(model, entity);
    case 'tracks': return applyTracks(model, entity, kind);
    case 'stress': return applyStress(model, entity);
    case 'wounds': return applyWounds(model, entity);
    default: return entity;
  }

  function applyPool(m, e) {
    const key = m.track_key;
    const cur = e[key]?.current ?? 0;
    const newCurrent = Math.max(0, cur - amount);
    const overflow = Math.max(0, amount - cur);
    return { ...e, [key]: { ...e[key], current: newCurrent, overflow } };
  }

  function applyTracks(m, e, k) {
    if (!k || !(m.tracks ?? []).includes(k)) return e;
    const cur = e[k]?.current ?? 0;
    return { ...e, [k]: { ...e[k], current: Math.max(0, cur - amount) } };
  }

  function applyStress(m, e) {
    const boxes = [...(e.stress ?? (m.boxes ?? []).map(() => false))];
    const capacities = m.boxes ?? [];
    for (let i = 0; i < capacities.length; i++) {
      if (!boxes[i] && capacities[i] >= amount) {
        boxes[i] = true;
        return { ...e, stress: boxes };
      }
    }
    return { ...e, stress: boxes, takenOut: true };
  }

  function applyWounds(m, e) {
    const tier = (m.thresholds ?? []).find((t) => amount <= t.max);
    if (!tier) return e;
    const wounds = [...(e.wounds ?? []), { tier: tier.tier, amount }];
    return { ...e, wounds };
  }
}
