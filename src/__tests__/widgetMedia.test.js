/**
 * Media in widget mode.
 *
 * Two independent holes. The widget never asked for the MSC4039 media
 * capabilities and `canUploadMedia` was only ever set by ClientManager,
 * so the Upload File option simply did not exist for widget users; and
 * `uploadMedia` called `widgetApi.uploadMedia`, which is not a method
 * on the widget API at all.
 *
 * Reading has the same answer: a widget has no client access token, so
 * it cannot fetch authenticated media itself, but the host client can
 * download on its behalf.
 */
import { describe, it, expect, vi } from 'vitest';
import { buildCapabilities } from '../widget/capabilities.js';
import { WidgetManager } from '../widget/WidgetManager.js';
import { mediaDownloaderSignal } from '../state/ui-signals.js';

describe('widget capabilities', () => {
  it('asks for upload and download of media', () => {
    const caps = buildCapabilities();
    expect(caps).toContain('org.matrix.msc4039.upload_file');
    expect(caps).toContain('org.matrix.msc4039.download_file');
  });
});

describe('WidgetManager media', () => {
  it('declares that it can upload, like the standalone client does', () => {
    expect(new WidgetManager().canUploadMedia).toBe(true);
  });

  it('uploads through the widget API and returns the content uri', async () => {
    const wm = new WidgetManager();
    wm.widgetApi = { uploadFile: vi.fn().mockResolvedValue({ content_uri: 'mxc://hs/abc' }) };
    const file = new File([new Blob(['x'])], 'map.png', { type: 'image/png' });
    expect(await wm.uploadMedia(file)).toBe('mxc://hs/abc');
    expect(wm.widgetApi.uploadFile).toHaveBeenCalledWith(file);
  });

  it('fails loudly when the host refuses the upload', async () => {
    const wm = new WidgetManager();
    wm.widgetApi = { uploadFile: vi.fn().mockRejectedValue(new Error('capability denied')) };
    await expect(wm.uploadMedia(new Blob(['x']))).rejects.toThrow(/capability denied/);
  });

  it('downloads media through the host, which holds the credential a widget lacks', async () => {
    const wm = new WidgetManager();
    const blob = new Blob(['img']);
    wm.widgetApi = { downloadFile: vi.fn().mockResolvedValue({ file: blob }) };
    expect(await wm.downloadMedia('mxc://hs/abc')).toBe(blob);
    expect(wm.widgetApi.downloadFile).toHaveBeenCalledWith('mxc://hs/abc');
  });

  it('reports no downloader before the widget API is attached', async () => {
    expect(await new WidgetManager().downloadMedia('mxc://hs/abc')).toBeNull();
  });
});


describe('wiring the host downloader', () => {
  it('publishes its downloader so the media cache can use it', async () => {
    mediaDownloaderSignal.value = null;
    const wm = new WidgetManager();
    const blob = new Blob(['img']);
    wm.widgetApi = { downloadFile: vi.fn().mockResolvedValue({ file: blob }) };
    wm.publishMediaDownloader();
    expect(typeof mediaDownloaderSignal.value).toBe('function');
    expect(await mediaDownloaderSignal.value('mxc://hs/abc')).toBe(blob);
    mediaDownloaderSignal.value = null;
  });

  it('clears it on destroy, so a torn-down widget serves nothing', () => {
    const wm = new WidgetManager();
    wm.widgetApi = { downloadFile: vi.fn() };
    wm.publishMediaDownloader();
    wm.destroy();
    expect(mediaDownloaderSignal.value).toBeNull();
  });
});

describe('standalone media download', () => {
  it('fetches the authenticated endpoint with a bearer token', async () => {
    const { ClientManager } = await import('../client/ClientManager.js');
    const blob = new Blob(['img']);
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, blob: async () => blob }));
    globalThis.fetch = /** @type {any} */ (fetchMock);

    class Fake { constructor({ homeserver, accessToken }) { this.homeserver = homeserver; this.accessToken = accessToken; } }
    const cm = new ClientManager({ matrixClientClass: Fake });
    cm.setCredentials('https://hs.example', 'syt_tok', '@a:hs.example', '!r:hs.example');

    expect(await cm.downloadMedia('mxc://hs.example/abc')).toBe(blob);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://hs.example/_matrix/client/v1/media/download/hs.example/abc');
    expect(init.headers.Authorization).toBe('Bearer syt_tok');
  });

  it('throws on a homeserver too old for the endpoint, so the cache falls back', async () => {
    const { ClientManager } = await import('../client/ClientManager.js');
    globalThis.fetch = /** @type {any} */ (vi.fn(async () => ({ ok: false, status: 404 })));
    class Fake { constructor({ homeserver, accessToken }) { this.homeserver = homeserver; this.accessToken = accessToken; } }
    const cm = new ClientManager({ matrixClientClass: Fake });
    cm.setCredentials('https://hs.example', 'tok', '@a:hs.example', '!r:hs.example');
    await expect(cm.downloadMedia('mxc://hs.example/abc')).rejects.toThrow(/404/);
  });

  it('ignores anything that is not an mxc uri', async () => {
    const { ClientManager } = await import('../client/ClientManager.js');
    const cm = new ClientManager({ matrixClientClass: class {} });
    expect(await cm.downloadMedia('https://cdn/x.png')).toBeNull();
  });
});
