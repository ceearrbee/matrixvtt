/**
 * lifecycle.js - StateManager lifecycle + refresh timers.
 *
 * `init` runs the one-shot startup (restore queue, load initial
 * state, subscribe) and starts two periodic refreshes. `destroy`
 * tears every interval/timer back down so there are no leaks on
 * session switch.
 */

import * as syncer from './syncer.js';
import { migrateUnscopedEntities } from './migration-unscoped.js';
import { logger } from '../utils/logger.js';

// Periodic full-state refresh as belt-and-suspenders for missed
// widget subscription events. Live subscriptions handle the
// steady-state case; this is the "missed an event" fallback.
const REFRESH_MS = 5 * 60 * 1000;
const MEMBERS_REFRESH_MS = 2 * 60 * 1000;

export async function init(sm) {
  syncer.restoreQueueFromStorage(sm);
  await sm.loadInitialState();
  try { migrateUnscopedEntities(sm); } catch (err) { logger.warn('Migration', err.message); }
  sm.subscribeToStateEvents();
  sm.loaded = true;

  // Pending Yjs updates must be re-applied only after loadInitialState:
  // the snapshot load inside it rebuilds the doc and would wipe them.
  sm.widgetManager?.getYjsTransport?.()?.restorePersistedPending?.();

  refreshPendingKnocks(sm);

  sm._onPageHide = () => {
    try { syncer.flushQueueToStorage(sm); } catch { /* storage unavailable */ }
  };
  window.addEventListener('pagehide', sm._onPageHide);

  if (!sm.widgetManager.isStandalone) {
    sm._refreshInterval = setInterval(() => refreshState(sm), REFRESH_MS);
    sm._membersRefreshInterval = setInterval(() => refreshMembers(sm), MEMBERS_REFRESH_MS);
  }
}

export async function refreshState(sm) {
  if (sm.refreshing || sm._cleaningUp) return;
  await sm.loadInitialState();
}

export async function refreshPendingKnocks(sm) {
  if (typeof sm.widgetManager?.getPendingKnocks !== 'function') return;
  if (!(await sm.widgetManager.canEditRoomState?.())) return;
  try {
    sm.pendingKnocks = await sm.widgetManager.getPendingKnocks();
  } catch {
    // Knocks that arrive later still surface via live member events.
  }
}

export function destroy(sm) {
  if (sm._refreshInterval) clearInterval(sm._refreshInterval);
  if (sm._membersRefreshInterval) clearInterval(sm._membersRefreshInterval);
  if (sm._drainTimer) { clearTimeout(sm._drainTimer); sm._drainTimer = null; }
  if (sm._onPageHide) {
    window.removeEventListener('pagehide', sm._onPageHide);
    sm._onPageHide = null;
  }
  for (const timer of sm._debounceTimers.values()) clearTimeout(timer);
  sm.subscriptionManager.destroy();
}

export async function refreshMembers(sm) {
  if (sm.widgetManager.isStandalone) return;
  if (typeof sm.widgetManager.getRoomMembers !== 'function') return;
  try {
    sm.roomMembers = await sm.widgetManager.getRoomMembers();
  } catch {
    // callee already surfaces errors; swallow so the interval survives.
  }
}
