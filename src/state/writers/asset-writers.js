/**
 * Room-scoped asset library: the `mxc://` references already uploaded
 * into this room, so a map image or a portrait is uploaded once and
 * reused rather than uploaded again.
 *
 * Holds references only, never image bytes.
 *
 * Not GM-gated, unlike its neighbours in world-writers: players upload
 * token portraits, and that is exactly why this lives in the Yjs doc
 * rather than a room state event, whose writes are power-level gated.
 */

import { allocateEntityId } from '../../utils/stable-id.js';
import { ASSET_KINDS, ASSET_LIBRARY_MAX_ENTRIES } from '../../utils/constants.js';

const KINDS = new Set(/** @type {string[]} */ (Object.values(ASSET_KINDS)));

/**
 * Record an uploaded image. Returns the asset id, the existing id when
 * this mxc is already known, or null when there is nothing to record.
 *
 * @param {object} sm - StateManager
 * @param {{mxc: string, name?: string, width?: number, height?: number, kind?: string, ts?: number}} asset
 * @returns {Promise<string|null>}
 */
export async function recordAsset(sm, asset) {
  const mxc = asset?.mxc;
  if (typeof mxc !== 'string' || !mxc.startsWith('mxc://')) return null;

  const existing = findByMxc(sm, mxc);
  if (existing) return existing;

  const id = await allocateEntityId('ast', sm.assets);
  sm.yjs.assetsMap.set(id, {
    id,
    mxc,
    name: asset.name ?? '',
    width: Number(asset.width) || null,
    height: Number(asset.height) || null,
    kind: KINDS.has(asset.kind) ? asset.kind : ASSET_KINDS.OTHER,
    uploaded_by: sm.widgetManager?.userId ?? null,
    ts: Number(asset.ts) || Date.now(),
  });
  evictOldest(sm);
  return id;
}

export async function removeAsset(sm, id) {
  if (!sm.assets.has(id)) return;
  sm.yjs.assetsMap.delete(id);
}

function findByMxc(sm, mxc) {
  for (const [id, asset] of sm.assets.entries()) {
    if (asset?.mxc === mxc) return id;
  }
  return null;
}

/**
 * Eviction can drop an entry a map still points at. That is harmless:
 * the map keeps its own image_url, and only the browse entry goes.
 */
function evictOldest(sm) {
  const overflow = sm.assets.size - ASSET_LIBRARY_MAX_ENTRIES;
  if (overflow <= 0) return;
  const oldest = [...sm.assets.values()]
    .sort((a, b) => (a?.ts ?? 0) - (b?.ts ?? 0))
    .slice(0, overflow);
  sm.yjs.assetsMap.doc.transact(() => {
    for (const asset of oldest) sm.yjs.assetsMap.delete(asset.id);
  });
}
