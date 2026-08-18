/**
 * Regression lock: localStorage caches that survive logout must be
 * user-scoped.
 *
 * Concern: on a shared machine, signing out user A and signing in
 * as user B must not surface A's per-user preferences (announcement
 * filters, hideGMActions, etc.) to B.
 *
 * The announcement settings key is `mvtt_announcements:<userId>` and
 * is loaded eagerly in the ChatIntegrator constructor - that load
 * path is what this test pins.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ChatIntegrator } from '../chat-integrator.js';
import { STORAGE_KEYS } from '../utils/constants.js';

function makeCM(userId) {
  return { userId, getRoomId: () => null };
}

describe('user-scoped announcements: no cross-user leak on logout/login', () => {
  beforeEach(() => { localStorage.clear(); });

  it('user B sees defaults when user A previously customized settings', () => {
    // Simulate user A's customized settings persisted under their key.
    localStorage.setItem(
      `${STORAGE_KEYS.ANNOUNCEMENTS}:@alice:s`,
      JSON.stringify({ damage: false, combat: false, mapChanges: false, hideGMActions: false }),
    );

    // User B logs in (sign-out flow already cleared session, but A's
    // settings may persist in localStorage on a shared machine).
    const ci = new ChatIntegrator(makeCM('@bob:s'), null, null);

    // Bob must see DEFAULTS, not Alice's overrides.
    expect(ci.announcements).toEqual({
      damage: true, combat: true, mapChanges: true, hideGMActions: true,
    });
  });

  it('user A sees their own customized settings when reloading as A', () => {
    localStorage.setItem(
      `${STORAGE_KEYS.ANNOUNCEMENTS}:@alice:s`,
      JSON.stringify({ damage: false, combat: false, mapChanges: false, hideGMActions: false }),
    );
    const ci = new ChatIntegrator(makeCM('@alice:s'), null, null);
    expect(ci.announcements.damage).toBe(false);
    expect(ci.announcements.combat).toBe(false);
  });

  it('saveAnnouncements writes to the user-scoped key, not the global one', () => {
    const ci = new ChatIntegrator(makeCM('@alice:s'), null, null);
    ci.setAnnouncementSettings({ damage: false });
    expect(localStorage.getItem(`${STORAGE_KEYS.ANNOUNCEMENTS}:@alice:s`)).toContain('"damage":false');
    // Critically: the unscoped legacy key is NOT written, so future
    // logins as a different user can't pick it up via the legacy fallback.
    expect(localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS)).toBeNull();
  });

  it('with no userId, no cross-user settings can be loaded (returns defaults)', () => {
    localStorage.setItem(
      `${STORAGE_KEYS.ANNOUNCEMENTS}:@alice:s`,
      JSON.stringify({ damage: false }),
    );
    const ci = new ChatIntegrator(makeCM(null), null, null);
    expect(ci.announcements.damage).toBe(true);
  });
});
