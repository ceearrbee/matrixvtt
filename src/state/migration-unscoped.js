/**
 * One-shot self-heal that backfills `map_id` on legacy walls, lights,
 * pins, templates, tokens, drawings and rekeys legacy fog from the
 * pre-Phase-1 singleton key '' to the active map id.
 *
 * Runs once during lifecycle.init when the local user is GM. CRDT
 * semantics make concurrent runs idempotent - same content → same
 * write → no divergence.
 */

import { isGM } from './reader.js';

const KEYED_FIELDS = ['wallsMap', 'lightsMap', 'pinsMap', 'templatesMap', 'tokensMap'];

export function migrateUnscopedEntities(sm) {
  if (!isGM(sm)) return;
  const targetId = sm.activeMapId || sm.yjs?.mapsMap?.keys?.().next?.()?.value;
  if (!targetId) return;

  sm.yjs.doc.transact(() => {
    for (const field of KEYED_FIELDS) {
      const map = sm.yjs[field];
      if (!map) continue;
      for (const [id, entity] of map.entries()) {
        if (!entity || entity.map_id) continue;
        map.set(id, { ...entity, map_id: targetId });
      }
    }

    // Drawings live in a Y.Array.
    if (sm.yjs.drawingsArray) {
      const arr = sm.yjs.drawingsArray;
      const orig = arr.toArray();
      const next = orig.map((d) => (d && !d.map_id ? { ...d, map_id: targetId } : d));
      const changed = next.some((d, i) => d !== orig[i]);
      if (changed) {
        if (arr.length > 0) arr.delete(0, arr.length);
        if (next.length > 0) arr.push(next);
      }
    }

    // Fog: legacy singleton lived at key ''.
    if (sm.yjs.fogMap?.has?.('')) {
      const legacy = sm.yjs.fogMap.get('');
      sm.yjs.fogMap.set(targetId, legacy);
      sm.yjs.fogMap.delete('');
    }
  });
}
