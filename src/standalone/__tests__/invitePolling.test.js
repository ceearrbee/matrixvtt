/**
 * Invite long-poll lifecycle. The polling loop is wrapped in an IIFE so
 * we don't await it directly - what matters is that:
 *   1. start attaches an AbortController to app.inviteAbort
 *   2. stop aborts the prior controller and clears the field
 *   3. start triggers onInvites when the first poll surfaces invites
 *   4. stop is a no-op when nothing is running
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startInvitePolling, stopInvitePolling } from '../discovery/invite-polling.js';

function makeApp() {
  return {
    inviteAbort: null,
    appLog: { add: vi.fn() },
  };
}

describe('invite polling lifecycle', () => {
  let app;
  beforeEach(() => { app = makeApp(); });
  afterEach(() => { stopInvitePolling(app); });

  it('start attaches an AbortController to app.inviteAbort', () => {
    const client = { sync: vi.fn().mockResolvedValue({ next_batch: 's1' }) };
    startInvitePolling(app, client, vi.fn());
    expect(app.inviteAbort).toBeInstanceOf(AbortController);
  });

  it('stop aborts the controller and clears the field', () => {
    const controller = new AbortController();
    app.inviteAbort = controller;
    const onAbort = vi.fn();
    controller.signal.addEventListener('abort', onAbort);
    stopInvitePolling(app);
    expect(onAbort).toHaveBeenCalled();
    expect(app.inviteAbort).toBeNull();
  });

  it('stop is safe when nothing is running', () => {
    expect(() => stopInvitePolling(app)).not.toThrow();
    expect(app.inviteAbort).toBeNull();
  });

  it('fires onInvites when the first long-poll batch contains invites', async () => {
    const onInvites = vi.fn();
    let calls = 0;
    const client = {
      sync: vi.fn().mockImplementation(() => {
        calls++;
        if (calls === 1) return Promise.resolve({ next_batch: 's1' });
        if (calls === 2) return Promise.resolve({ next_batch: 's2', rooms: { invite: { '!r:id': {} } } });
        // Third call: abort the loop and reject so the IIFE exits cleanly.
        stopInvitePolling(app);
        return Promise.reject(new DOMException('aborted', 'AbortError'));
      }),
    };

    startInvitePolling(app, client, onInvites);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(onInvites).toHaveBeenCalled();
  });

  it('does not fire onInvites when the batch has no invites', async () => {
    const onInvites = vi.fn();
    let calls = 0;
    const client = {
      sync: vi.fn().mockImplementation(() => {
        calls++;
        if (calls === 1) return Promise.resolve({ next_batch: 's1' });
        if (calls === 2) return Promise.resolve({ next_batch: 's2', rooms: { invite: {} } });
        stopInvitePolling(app);
        return Promise.reject(new DOMException('aborted', 'AbortError'));
      }),
    };

    startInvitePolling(app, client, onInvites);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(onInvites).not.toHaveBeenCalled();
  });
});
