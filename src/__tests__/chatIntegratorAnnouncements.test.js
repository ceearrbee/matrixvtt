/**
 * Regression: announcement preferences must be user-scoped. Without
 * scoping, User B inherits User A's chat-announce settings on the
 * same browser/tab. The fix uses the global key as a one-time
 * fallback for the upgrade, then writes only the user-scoped key.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatIntegrator } from '../chat-integrator.js';
import { STORAGE_KEYS } from '../utils/constants.js';

function makeClientManager(userId) {
  return { userId, sendRoomEvent: vi.fn() };
}

function makeState() {
  return { settings: {} };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('ChatIntegrator announcements scoping', () => {
  it('writes a per-user key, not the global key', () => {
    const ci = new ChatIntegrator(makeClientManager('@a:hs'), makeState(), {});
    ci.announcements = { damage: false, combat: true, mapChanges: true, hideGMActions: true };
    ci.saveAnnouncements();
    expect(window.localStorage.getItem(`${STORAGE_KEYS.ANNOUNCEMENTS}:@a:hs`)).toBeTruthy();
    expect(window.localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS)).toBeNull();
  });

  it('User B does not inherit User A prefs from per-user key', () => {
    window.localStorage.setItem(
      `${STORAGE_KEYS.ANNOUNCEMENTS}:@a:hs`,
      JSON.stringify({ damage: false }),
    );
    const ciB = new ChatIntegrator(makeClientManager('@b:hs'), makeState(), {});
    expect(ciB.announcements.damage).toBe(true); // default, not A's "false"
  });

  it('on first run after upgrade, falls back to the legacy global key', () => {
    window.localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify({ damage: false }));
    const ci = new ChatIntegrator(makeClientManager('@a:hs'), makeState(), {});
    expect(ci.announcements.damage).toBe(false);
  });
});
