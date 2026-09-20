/**
 * Resolving `mxc://` media for a browser that has to render it.
 *
 * Matrix 1.11 moved media behind an authenticated endpoint and Synapse
 * 1.146 enforces it, so the old `/_matrix/media/v3/download/` path now
 * returns 404. The replacement wants an `Authorization` header, which
 * an `<img src>` cannot send, so media is fetched here and handed back
 * as an object URL that both `<img>` and Konva can use.
 *
 * Resolution is asynchronous the first time: `resolveMedia` returns
 * null and calls `onReady` once the blob has landed. Callers render
 * their no-image fallback until then.
 *
 * Neither transport hands the URL over directly: the standalone client
 * fetches with its access token, and a widget asks the host to fetch on
 * its behalf (MSC4039), because a widget is never given a credential
 * the media endpoint accepts. With no downloader published at all, this
 * falls back to the legacy unauthenticated URL synchronously.
 */

import { accessTokenSignal, homeserverSignal, mediaDownloaderSignal } from '../state/ui-signals.js';
import { logger } from './logger.js';

export const MEDIA_CACHE_MAX = 60;

/** mxc uri -> object URL, or a legacy URL when authentication is unavailable. */
const resolved = new Map();
const inFlight = new Map();

/**
 * @param {string|null|undefined} url
 * @param {() => void} [onReady] - called once, when an unresolved mxc lands
 * @returns {string|null} a URL usable right now, or null while it loads
 */
export function resolveMedia(url, onReady) {
  if (!url) return null;
  if (!url.startsWith('mxc://')) return url;

  const hit = resolved.get(url);
  if (hit) {
    resolved.delete(url);
    resolved.set(url, hit);
    return hit;
  }

  const homeserver = homeserverSignal.peek();
  const download = mediaDownloaderSignal.peek();
  if (!download) return legacyUrl(url, homeserver);

  const pending = inFlight.get(url);
  if (pending) {
    if (onReady) pending.push(onReady);
    return null;
  }
  inFlight.set(url, onReady ? [onReady] : []);
  fetchMedia(url, homeserver, download);
  return null;
}

async function fetchMedia(url, homeserver, download) {
  let value;
  try {
    const blob = await download(url);
    if (!blob) throw new Error('media download returned nothing');
    value = URL.createObjectURL(blob);
  } catch (err) {
    // A homeserver predating Matrix 1.11 has no such endpoint, and an
    // offline tab has no network. Either way the legacy URL is the best
    // remaining guess, and caching it stops a retry storm.
    logger.warn('media', 'Authenticated media failed, falling back:', err?.message || err);
    value = legacyUrl(url, homeserver);
  }

  resolved.set(url, value);
  evict();
  const waiting = inFlight.get(url) ?? [];
  inFlight.delete(url);
  for (const cb of waiting) cb();
}

function parts(url, homeserver) {
  const path = url.slice(6);
  const base = homeserver || `https://${path.split('/')[0]}`;
  return { base, path };
}

function legacyUrl(url, homeserver) {
  const { base, path } = parts(url, homeserver);
  return `${base}/_matrix/media/v3/download/${path}`;
}

function evict() {
  while (resolved.size > MEDIA_CACHE_MAX) {
    const oldest = resolved.keys().next().value;
    release(resolved.get(oldest));
    resolved.delete(oldest);
  }
}

function release(value) {
  if (typeof value === 'string' && value.startsWith('blob:')) URL.revokeObjectURL(value);
}

/**
 * Drop everything a session's media depends on: the decoded blobs and
 * the credentials that fetched them. Called on teardown so a second
 * login never serves the first one's images.
 */
export function clearMediaSession() {
  _resetMediaCache();
  accessTokenSignal.value = null;
  homeserverSignal.value = null;
  mediaDownloaderSignal.value = null;
}

// Test-only reset
export function _resetMediaCache() {
  for (const value of resolved.values()) release(value);
  resolved.clear();
  inFlight.clear();
}
