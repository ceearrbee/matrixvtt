/**
 * Authenticated media.
 *
 * Synapse 1.146 enforces authenticated media, so the old
 * `/_matrix/media/v3/download/` path returns 404 and every uploaded map
 * and portrait fails. The replacement needs an Authorization header,
 * which an <img> cannot send, so media is fetched and handed to the
 * page as an object URL instead.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveMedia, _resetMediaCache, MEDIA_CACHE_MAX } from '../utils/media-cache.js';
import { homeserverSignal, accessTokenSignal, mediaDownloaderSignal } from '../state/ui-signals.js';

const MXC = 'mxc://hs.example/abc123';
const LEGACY = 'https://hs.example/_matrix/media/v3/download/hs.example/abc123';

function settle() { return new Promise((r) => setTimeout(r, 0)); }

let created;
beforeEach(() => {
  _resetMediaCache();
  homeserverSignal.value = 'https://hs.example';
  accessTokenSignal.value = 'syt_token';
  created = [];
  globalThis.URL.createObjectURL = vi.fn(() => {
    const u = `blob:mock/${created.length}`;
    created.push(u);
    return u;
  });
  globalThis.URL.revokeObjectURL = vi.fn();
  globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, blob: async () => new Blob(['img']) }));
  mediaDownloaderSignal.value = vi.fn(async () => new Blob(['img']));
});

afterEach(() => {
  homeserverSignal.value = null;
  accessTokenSignal.value = null;
  mediaDownloaderSignal.value = null;
  delete globalThis.fetch;
});

describe('resolveMedia', () => {
  it('passes a non-mxc url straight through, synchronously', () => {
    expect(resolveMedia('https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
    expect(resolveMedia('/matrixvtt/icons/dark/lorc/sword.svg')).toBe('/matrixvtt/icons/dark/lorc/sword.svg');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns null for nothing', () => {
    expect(resolveMedia(null)).toBeNull();
    expect(resolveMedia('')).toBeNull();
  });

  it('hands back an object url once the fetch lands, and caches it', async () => {
    resolveMedia(MXC);
    await settle();
    expect(resolveMedia(MXC)).toBe(created[0]);
    expect(mediaDownloaderSignal.value).toHaveBeenCalledTimes(1);
  });

  it('notifies the caller when the media becomes available', async () => {
    const onReady = vi.fn();
    resolveMedia(MXC, onReady);
    await settle();
    expect(onReady).toHaveBeenCalled();
  });

  it('only fetches once for concurrent callers', async () => {
    resolveMedia(MXC);
    resolveMedia(MXC);
    resolveMedia(MXC);
    await settle();
    expect(mediaDownloaderSignal.value).toHaveBeenCalledTimes(1);
  });

  // A logged-out preview has no transport to ask. Keep the old
  // behaviour rather than rendering nothing.
  it('uses the legacy url synchronously when nobody can download', () => {
    mediaDownloaderSignal.value = null;
    expect(resolveMedia(MXC)).toBe(LEGACY);
  });

  it('falls back to the legacy url when the download fails', async () => {
    mediaDownloaderSignal.value = vi.fn(async () => { throw new Error('404'); });
    resolveMedia(MXC);
    await settle();
    expect(resolveMedia(MXC)).toBe(LEGACY);
  });

  it('does not retry a url it has already resolved to the fallback', async () => {
    const download = vi.fn(async () => { throw new Error('404'); });
    mediaDownloaderSignal.value = download;
    resolveMedia(MXC);
    await settle();
    resolveMedia(MXC);
    await settle();
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('revokes the object url it evicts, so long sessions do not leak blobs', async () => {
    for (let i = 0; i < MEDIA_CACHE_MAX + 1; i += 1) {
      resolveMedia(`mxc://hs.example/id${i}`);
      await settle();
    }
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith(created[0]);
  });

  it('revokes everything on reset', async () => {
    resolveMedia(MXC);
    await settle();
    _resetMediaCache();
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith(created[0]);
  });
});

describe('resolveMedia in widget mode', () => {
  it('asks whichever transport is connected, with the mxc uri', async () => {
    const download = vi.fn().mockResolvedValue(new Blob(['img']));
    mediaDownloaderSignal.value = download;
    expect(resolveMedia(MXC)).toBeNull();
    await settle();
    expect(download).toHaveBeenCalledWith(MXC);
    expect(resolveMedia(MXC)).toBe(created[0]);
  });

  it('falls back to the legacy url when the host cannot download', async () => {
    mediaDownloaderSignal.value = vi.fn().mockResolvedValue(null);
    resolveMedia(MXC);
    await settle();
    expect(resolveMedia(MXC)).toBe(LEGACY);
  });
});
