/**
 * Incoming Matrix state events → StateManager collections.
 *
 * `handleStateEvent` dispatches one event; `loadInitialState` bulk-loads all
 * current state and `subscribeToStateEvents` wires the live subscriptions.
 */

import { EVENT_TYPES, isUiMode } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import { clearAllCollections } from './syncer-load.js';
import { loadLatestSnapshot } from './yjsSnapshot.js';
import { suggestedModeSignal } from './ui-signals.js';

// VTT entity state lives in Yjs. The syncer's only remaining job for
// VTT data is loading the authoritative SNAPSHOT on join. The handlers
// below cover membership and POWER_LEVELS, which stay on Matrix LWW
// because the homeserver owns them.

/**
 * Apply an incoming `m.vtt.ui_mode` Matrix state event.
 *
 * Echo suppression: the local user's own broadcast is dropped so the
 * GM who flipped the mode doesn't get banner-spammed by their own pick.
 * An empty content (`{}`) is a tombstone that clears the suggestion.
 * Anything else is validated against the canonical mode list before
 * being written into `suggestedModeSignal`.
 */
export function handleUiModeStateEvent(sm, event) {
  const sender = event?.sender;
  const localUserId = sm?.widgetManager?.userId;
  if (sender && localUserId && sender === localUserId) return;
  const content = event?.content;
  const isTombstone = !content || (typeof content === 'object' && Object.keys(content).length === 0);
  if (isTombstone) { suggestedModeSignal.value = null; return; }
  const mode = content?.mode;
  if (!isUiMode(mode)) return;
  suggestedModeSignal.value = mode;
}

export function handleStateEvent(sm, event) {
  const { type, content } = event;
  const isTombstone = !content || (typeof content === 'object' && Object.keys(content).length === 0);
  logger.log('MatrixIO', `← STATE ${type}`, { content });
  if (type === EVENT_TYPES.POWER_LEVELS) {
    sm.powerLevels = isTombstone ? null : content;
  }
}

export function handleMemberEvent(sm, event) {
  const userId = event.state_key;
  const { membership, displayname = '', reason = '' } = event.content ?? {};
  logger.log('MatrixIO', `← MEMBER ${userId ?? ''} ${membership ?? ''}`, event.content);
  if (!userId) return;

  if (membership === 'knock') {
    sm.pendingKnocks = [
      ...(sm.pendingKnocks ?? []).filter((k) => k.userId !== userId),
      { userId, displayname, reason },
    ];
    return;
  }
  if ((sm.pendingKnocks ?? []).some((k) => k.userId === userId)) {
    sm.pendingKnocks = sm.pendingKnocks.filter((k) => k.userId !== userId);
  }

  if (membership === 'join') {
    const idx = sm.roomMembers.findIndex((m) => m.userId === userId);
    sm.roomMembers = idx >= 0
      ? sm.roomMembers.map((m, i) => (i === idx ? { ...m, displayname } : m))
      : [...sm.roomMembers, { userId, displayname, inCall: false }];
  } else if (membership === 'leave' || membership === 'ban') {
    sm.roomMembers = sm.roomMembers.filter((m) => m.userId !== userId);
  }
}

function handleCallMemberEvent(sm, event) {
  const userId = event.state_key;
  const calls = event.content?.['m.calls'] ?? [];
  const inCall = Array.isArray(calls) && calls.length > 0;
  logger.log('MatrixIO', `← CALL_MEMBER ${userId ?? ''} inCall=${inCall}`);
  if (!userId) return;

  const idx = sm.roomMembers.findIndex((m) => m.userId === userId);
  if (idx >= 0) {
    sm.roomMembers = sm.roomMembers.map((m, i) => (i === idx ? { ...m, inCall } : m));
  }
}

export function subscribeToStateEvents(sm) {
  const api = sm.widgetManager.getApi();
  if (!api) return;

  // VTT entity types ride on Yjs; we only subscribe to Matrix LWW for
  // homeserver-owned state (membership, call membership, power levels).
  sm.subscriptionManager.subscribe(
    `state:${EVENT_TYPES.POWER_LEVELS}`,
    api.observeStateEvents(EVENT_TYPES.POWER_LEVELS),
    (event) => handleStateEvent(sm, event),
  );
  sm.subscriptionManager.subscribe(
    `state:${EVENT_TYPES.ROOM_MEMBER}`,
    api.observeStateEvents(EVENT_TYPES.ROOM_MEMBER),
    (event) => handleMemberEvent(sm, event),
  );
  sm.subscriptionManager.subscribe(
    'state:org.matrix.msc3401.call.member',
    api.observeStateEvents('org.matrix.msc3401.call.member'),
    (event) => handleCallMemberEvent(sm, event),
  );
  sm.subscriptionManager.subscribe(
    `state:${EVENT_TYPES.UI_MODE}`,
    api.observeStateEvents(EVENT_TYPES.UI_MODE),
    (event) => handleUiModeStateEvent(sm, event),
  );
}

export async function loadInitialState(sm) {
  const api = sm.widgetManager.getApi();
  if (!api) return;
  // Re-entrant calls (init + sync-recovered + refresh interval) could both
  // clearAllCollections, wiping each other's state.
  if (sm.refreshing) return;

  sm.refreshing = true;
  try {
    clearAllCollections(sm);
    await loadPowerLevels(sm, api);
    await loadLatestSnapshot(sm, api);
  } finally {
    sm.refreshing = false;
  }
}

// The live subscription only delivers power_levels *changes*; isGM needs the
// current value at startup.
async function loadPowerLevels(sm, api) {
  try {
    const events = await api.receiveStateEvents(EVENT_TYPES.POWER_LEVELS);
    const event = Array.isArray(events) ? events[0] : null;
    if (event) handleStateEvent(sm, event);
  } catch (err) {
    logger.warn('MatrixIO', 'power_levels read failed', err);
  }
}

// Re-exports so tests and callers can import queue helpers via syncer.js
// (preserves older import paths that referenced state-sync.js).
export {
  sendStateEvent,
  sendRoomEvent,
  drainRetryQueue,
  flushQueueToStorage,
  restoreQueueFromStorage,
  isRateLimited,
} from './queue.js';
