/**
 * A session's media must not outlive it. Object URLs hold the decoded
 * blob, and the access token that fetched them belongs to one login, so
 * both go on teardown - the localStorage-survives-logout pitfall in the
 * same shape.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clearMediaSession } from '../utils/media-cache.js';
import { resolveMedia, _resetMediaCache } from '../utils/media-cache.js';
import { accessTokenSignal, homeserverSignal, mediaDownloaderSignal } from '../state/ui-signals.js';

beforeEach(() => {
  _resetMediaCache();
  homeserverSignal.value = 'https://hs.example';
  accessTokenSignal.value = 'syt_token';
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock/1');
  globalThis.URL.revokeObjectURL = vi.fn();
  globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, blob: async () => new Blob(['x']) }));
  mediaDownloaderSignal.value = vi.fn(async () => new Blob(['x']));
});
afterEach(() => {
  homeserverSignal.value = null;
  accessTokenSignal.value = null;
  mediaDownloaderSignal.value = null;
  delete globalThis.fetch;
});

describe('clearMediaSession', () => {
  it('revokes cached object urls and drops the credentials', async () => {
    resolveMedia('mxc://hs.example/abc');
    await new Promise((r) => setTimeout(r, 0));
    clearMediaSession();
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock/1');
    expect(accessTokenSignal.value).toBeNull();
    expect(homeserverSignal.value).toBeNull();
    expect(mediaDownloaderSignal.value).toBeNull();
  });

  it('leaves the next session resolving from scratch', async () => {
    resolveMedia('mxc://hs.example/abc');
    await new Promise((r) => setTimeout(r, 0));
    clearMediaSession();
    const second = vi.fn(async () => new Blob(['y']));
    accessTokenSignal.value = 'syt_other';
    homeserverSignal.value = 'https://other.example';
    mediaDownloaderSignal.value = second;
    resolveMedia('mxc://hs.example/abc');
    await new Promise((r) => setTimeout(r, 0));
    expect(second).toHaveBeenCalledTimes(1);
  });
});
