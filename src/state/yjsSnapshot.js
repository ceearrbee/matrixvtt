/**
 * Shared helper: fetch the latest Yjs SNAPSHOT state events from a
 * room, reassemble them, and apply via YjsManager.loadSnapshot.
 *
 * Used by initial-load (syncer.js) and by divergence recovery
 * (StateManager._wireYjsBridges).
 *
 * The snapshot is published in multiple state events (one per chunk,
 * keyed by `${marker}-${idx}`) because matrix.org caps events around
 * 64 KB and a mid-size campaign's binary snapshot doesn't fit in one.
 * See `yjs-snapshot-publish.js` for the writer side.
 *
 * Backwards-compatible: rooms with the older single-event snapshot
 * (state_key === "", no idx/total) load identically - the chunk
 * picker treats them as a 1-chunk group.
 */

import { YJS_EVENT_TYPES } from './YjsManager.js';
import { logger } from '../utils/logger.js';
import { chooseLatestCompleteSnapshot, joinChunks, base64ToBytes } from './snapshot-chunks.js';

export async function loadLatestSnapshot(sm, api) {
  try {
    const events = await api.receiveStateEvents(YJS_EVENT_TYPES.SNAPSHOT);
    const picked = chooseLatestCompleteSnapshot(events || []);
    if (!picked) return false;
    const ordered = [...picked.chunks].sort((a, b) => a.idx - b.idx);
    const bytes = joinChunks(ordered.map((c) => base64ToBytes(c.data)));
    sm.yjs.loadSnapshot(bytes, picked.marker);
    logger.log('YjsSnapshot',
      `loaded marker=${picked.marker} chunks=${ordered.length} binarySize=${bytes.length}`,
    );
    return true;
  } catch (err) {
    logger.warn('Yjs', 'snapshot load failed', err?.message || err);
    return false;
  }
}
