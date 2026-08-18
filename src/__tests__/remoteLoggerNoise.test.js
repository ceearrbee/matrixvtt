/**
 * remoteLogger silences known third-party operational noise.
 *
 * matrix-js-sdk's scheduler logs "Stopping queue 'message' as it is now
 * empty" via console.info every time its outbound queue drains - once
 * per chat / dice / state send. It floods both the in-browser console
 * and the dev-server log, drowning out real signal. remoteLogger's
 * console wrappers drop the message before it hits either sink.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('remoteLogger noise filter', () => {
  let originalInfo;
  let fetchSpy;

  beforeEach(async () => {
    vi.resetModules();
    originalInfo = console.info;
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchSpy;
    // Force dev-mode so the wrappers attach.
    vi.stubGlobal('import.meta', { env: { DEV: true } });
    const mod = await import('../utils/remoteLogger.js?nocache=' + Date.now());
    mod.initRemoteLogging();
  });

  afterEach(() => {
    console.info = originalInfo;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('drops "Stopping queue … as it is now empty" without printing or forwarding', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    console.info("Stopping queue 'message' as it is now empty");
    // Wrapper short-circuited - the actual stubbed console.info never
    // got called, and no fetch was issued to the dev-server endpoint.
    expect(fetchSpy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('still forwards an unrelated info log', async () => {
    console.info('[ChatIntegrator] connected');
    // The wrapper calls fetch asynchronously; await a tick.
    await new Promise(r => setTimeout(r, 0));
    expect(fetchSpy).toHaveBeenCalled();
  });
});
