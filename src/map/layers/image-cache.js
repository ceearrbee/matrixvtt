/**
 * Lazy image loader for map layers and tokens, keyed by URL on the renderer.
 *
 * Caches Image objects in `mr._tokenImages` (a JS Map; insertion order
 * preserved). LRU-capped at 100 to keep long sessions from holding
 * dozens of MB of resident token portraits. Repeated access bumps the
 * URL to most-recently-used by re-inserting it.
 */

import { resolveMediaUrl } from '../../utils/mxc.js';

const MAX_IMAGES = 100;

export function getOrLoadImage(mr, url, _id) {
  if (!url) return null;
  const cache = mr._tokenImages;
  if (cache.has(url)) {
    // Bump to most-recently-used: delete + set re-inserts at the end.
    const existing = cache.get(url);
    cache.delete(url);
    cache.set(url, existing);
    return existing;
  }
  const img = new Image();
  img.onload = () => { mr.render(); };
  img.onerror = () => { mr.render(); };
  img.src = resolveMediaUrl(url, mr.state.widgetManager?.homeserver);
  cache.set(url, img);
  if (cache.size > MAX_IMAGES) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  return img;
}
