/**
 * Yjs → StateManager signal bridges. Extracted from StateManager so the
 * facade itself stays focused on collection accessors and delegation.
 *
 * For each keyed Yjs collection we subscribe to the `ids$` signal and,
 * for every id, to the per-id signal - so a remote mutation flows
 * straight into the matching ReactiveMap. Singletons are bridged
 * through the `''` key. Divergence recovery debounces snapshot reloads
 * so a stale snapshot can't drive a tight retry loop.
 */

import { batch } from '@preact/signals';
import { loadLatestSnapshot } from './yjsSnapshot.js';
import { logger } from '../utils/logger.js';
import { fogSignal } from './signals.js';
import { applySettings } from './syncer-apply.js';
import { isGM } from './reader.js';

const KEYED_COLLECTIONS = [
  'tokens', 'characters', 'npcs', 'items', 'spells',
  'handouts', 'tables', 'walls', 'lights', 'pins', 'templates', 'maps',
  'pages',
];

export function wireYjsBridges(sm) {
  if (typeof sm.subscriptionManager?.subscribe !== 'function') return;

  for (const field of KEYED_COLLECTIONS) {
    bridgeKeyedCollection(sm, field);
  }

  bridgeFogCollection(sm);
  bridgeSingleton(sm, 'initiative', (val) => {
    // Mirror the syncer's tombstone normalization: an empty / null
    // value becomes the canonical empty shape so consumers can rely
    // on `sm.initiative.order` etc. existing.
    sm.initiative = (val && Object.keys(val).length > 0)
      ? val
      : { active: false, round: 0, current_index: 0, order: [] };
  });
  bridgeSingleton(sm, 'settings',   (val) => {
    // Route through applySettings so the systemConfig preset gets
    // resolved from the `system` slug. Writing val directly here used
    // to leave systemConfig undefined (updateSettings strips it before
    // write - preset is resolved at read time), which silently broke
    // every config-driven sheet section. applySettings also mirrors
    // active_map_id onto sm.activeMapId.
    applySettings(sm, val ?? {});
  });

  const drawingsSignal = sm.yjs.drawings.get('root');
  if (drawingsSignal) {
    sm.subscriptionManager.subscribe('yjs:drawings', drawingsSignal, (val) => {
      // Always normalize to an array, like the syncer's applyDrawing:
      // writing `val` raw lets a null / undefined / wrapper-object
      // emission leave sm.drawings non-array, and the next .filter()
      // in the renderer throws TypeError.
      sm.drawings = Array.isArray(val)
        ? val
        : (Array.isArray(val?.strokes) ? val.strokes : []);
    });
  }

  wireDivergenceRecovery(sm);
}

function bridgeKeyedCollection(sm, field) {
  const bridge = sm.yjs[field];
  const local = sm[field];
  // Ids already wired to a per-entity subscription. Without this, every id
  // emission tore down and rebuilt the subscription for every entity in the
  // collection - adding one token to a 200-token map did 200 re-subscribes,
  // each re-firing its handler.
  /** @type {Set<string>} */
  const subscribed = new Set();

  sm.subscriptionManager.subscribe(`yjs:${field}-ids`, bridge.ids, (ids) => {
    const present = new Set(ids);
    batch(() => {
      for (const id of [...local.keys()]) {
        if (!present.has(id)) local.delete(id);
      }
      for (const id of [...subscribed]) {
        if (present.has(id)) continue;
        sm.subscriptionManager.unsubscribe(`yjs:${field}:${id}`);
        subscribed.delete(id);
      }
      for (const id of ids) {
        if (subscribed.has(id)) continue;
        const ySignal = bridge.get(id);
        if (!ySignal) continue;
        subscribed.add(id);
        sm.subscriptionManager.subscribe(`yjs:${field}:${id}`, ySignal, (val) => {
          if (shouldDropForVisibility(sm, field, val)) {
            if (local.has(id)) local.delete(id);
            return;
          }
          if (local.get(id) !== val) local.set(id, val);
        });
      }
    });
  });
}

function shouldDropForVisibility(sm, field, val) {
  if (!val || typeof val !== 'object') return false;
  if (isGM(sm)) return false;
  if (field === 'npcs' && val.is_hidden === true) return true;
  if (field === 'tokens') {
    const myId = sm.widgetManager?.userId;
    if (val.visible === false && val.owner_user_id !== myId) return true;
  }
  return false;
}

function bridgeFogCollection(sm) {
  const bridge = sm.yjs.fog;
  sm.subscriptionManager.subscribe('yjs:fog-ids', bridge.ids, (ids) => {
    batch(() => {
      const next = new Map(fogSignal.value);
      for (const id of next.keys()) if (!ids.includes(id)) next.delete(id);
      fogSignal.value = next;
      for (const id of ids) {
        const ySignal = bridge.get(id);
        if (!ySignal) continue;
        sm.subscriptionManager.subscribe(`yjs:fog:${id}`, ySignal, (val) => {
          const m = new Map(fogSignal.value);
          if (val && Object.keys(val).length > 0) m.set(id, val);
          else m.delete(id);
          fogSignal.value = m;
        });
      }
    });
  });
}

function bridgeSingleton(sm, field, apply) {
  const bridge = sm.yjs[field];
  sm.subscriptionManager.subscribe(`yjs:${field}-ids`, bridge.ids, () => {
    const sig = bridge.get('');
    if (!sig) return;
    sm.subscriptionManager.subscribe(`yjs:${field}`, sig, (val) => apply(val));
  });
}

function wireDivergenceRecovery(sm) {
  // When a lagging peer's gap is too large to gossip as a diff, the
  // transport asks for a snapshot instead. publishYjsSnapshot is
  // GM-gated internally, so this is a no-op on clients that can't.
  const transport = sm.widgetManager?.getYjsTransport?.();
  if (transport) {
    transport.onOversizedDiff = () => {
      import('./yjs-snapshot-publish.js')
        .then(({ publishYjsSnapshot }) => publishYjsSnapshot(sm))
        .catch((err) => logger.warn('Yjs', `oversized-diff snapshot publish failed: ${err?.message || err}`));
    };
  }

  sm._lastDivergenceRecoveryAt = 0;
  sm.yjs.onDivergence(async () => {
    const now = Date.now();
    if (now - sm._lastDivergenceRecoveryAt < 30_000) return;
    sm._lastDivergenceRecoveryAt = now;
    const api = sm.widgetManager?.getApi?.();
    const recovered = api ? await loadLatestSnapshot(sm, api) : false;
    if (recovered) {
      logger.warn('Yjs', 'State drift recovered from snapshot');
      return;
    }
    // Recovery couldn't find a snapshot - either the room hasn't
    // published one yet (fresh seed) or the peer fork resolves on its
    // own via the next UPDATE chunk gossip. There's nothing the user
    // can do about either case, so log the warning but DON'T surface
    // a toast: a user-facing "state drift" warning is alarming and
    // has no actionable next step. If forking is real and persistent,
    // it'll re-fire after the 30-second backoff window and on each
    // re-fire the in-app log gets another breadcrumb.
    logger.warn('Yjs', 'Forked state - no snapshot to recover from; deferring to gossip');
  });
}
