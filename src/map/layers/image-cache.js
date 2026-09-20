/**
 * Lazy image loader for map layers and tokens, keyed by URL on the renderer.
 *
 * Caches Image objects in `mr._tokenImages` (a JS Map; insertion order
 * preserved). LRU-capped at 100 to keep long sessions from holding
 * dozens of MB of resident token portraits. Repeated access bumps the
 * URL to most-recently-used by re-inserting it.
 */

import { resolveMedia } from '../../utils/media-cache.js';

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
  // Authenticated media resolves asynchronously, so the src may not be
  // known yet; the callback re-renders once it is.
  const src = resolveMedia(url, () => {
    const pending = cache.get(url);
    if (pending && !pending.src) pending.src = resolveMedia(url) || '';
    mr.render?.();
  });
  const img = new Image();
  img.onload = () => { mr.render?.(); };
  img.onerror = () => { mr.render?.(); };
  if (src) img.src = src;
  cache.set(url, img);
  if (cache.size > MAX_IMAGES) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  return img;
}
