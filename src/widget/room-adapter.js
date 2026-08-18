/**
 * Room-level queries against the widget API: power levels, memberships,
 * moderation actions.
 *
 * Every helper takes the WidgetManager instance (`wm`) as first arg so it can
 * reach `widgetApi`, the cached `roomIdsSupported` probe, and the call-counter.
 * The `roomIds` option varies across Element Web versions; helpers fall back
 * to the legacy path when the modern one is rejected.
 */

import { EVENT_TYPES } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import { VTTError, ErrorType, showErrorNotification } from '../utils/errorHandling.js';
import { computeNewPowerLevels, RECEIVABLE_STATE_TYPES } from './capabilities.js';
import { retryOnRateLimit } from '../utils/matrixRetry.js';

const MOD_POWER_LEVEL = 50;

function hasExplicitRoomId(wm) {
  return !!wm.roomId && wm.roomId.startsWith('!');
}

function isEmptyResult(value) {
  return value == null || (Array.isArray(value) && value.length === 0);
}

async function withRoomIdFallback(wm, fetcher) {
  if (hasExplicitRoomId(wm) && wm._roomIdsSupported !== false) {
    try {
      const result = await fetcher({ roomIds: [wm.roomId] });
      // Element answers scoped reads it will not serve with an empty
      // list instead of an error. Treat "nothing" as a miss so the
      // implicit-room read still runs.
      if (!isEmptyResult(result)) {
        wm._roomIdsSupported = true;
        return { ok: true, value: result };
      }
    } catch {
      if (wm._roomIdsSupported === null) wm._roomIdsSupported = false;
    }
  }
  try {
    return { ok: true, value: await fetcher({}) };
  } catch (error) {
    return { ok: false, error };
  }
}

export async function getRoomState(wm) {
  if (!wm.widgetApi) return [];
  const reads = RECEIVABLE_STATE_TYPES.map((type) =>
    withRoomIdFallback(wm, (opts) => wm.widgetApi.receiveStateEvents(type, opts))
  );
  const results = await Promise.all(reads);
  return results
    .flatMap((r) => (r.ok && Array.isArray(r.value) ? r.value : []))
    .map((e) => ({ type: e.type, state_key: e.state_key, content: e.content, event_id: e.event_id }));
}

export async function getUserPowerLevel(wm) {
  if (!wm.widgetApi) return 0;

  const fetcher = async (opts) => {
    const events = await wm.widgetApi.receiveStateEvents('m.room.power_levels', opts);
    if (!events || events.length === 0) return null;
    const powerLevels = events[0].content;
    return powerLevels?.users?.[wm.userId] ?? powerLevels?.users_default ?? 0;
  };

  const result = await withRoomIdFallback(wm, fetcher);
  if (!result.ok) {
    showErrorNotification(
      new VTTError(ErrorType.NETWORK, `Failed to get power level: ${result.error.message}`, result.error)
    );
    return 0;
  }
  if (result.value == null) {
    logger.warn('RoomAdapter', `power_levels read returned no events (room ${wm.roomId}, user ${wm.userId})`);
    return 0;
  }
  logger.log('RoomAdapter', `power level ${result.value} for ${wm.userId} in ${wm.roomId}`);
  return result.value;
}

/**
 * Same 30-second TTL cache as ClientManager.canEditRoomState - both
 * paths perform the same power-level lookup and the wizard / GM-only
 * UI calls this in tight loops. Without parity, widget mode hits the
 * Matrix homeserver many more times than standalone mode for the
 * same check.
 */
const CAN_EDIT_TTL_MS = 30_000;

export async function canEditRoomState(wm) {
  const now = Date.now();
  if (wm._canEditCache && now < wm._canEditCache.expiry) {
    return wm._canEditCache.value;
  }
  const level = await getUserPowerLevel(wm);
  const value = level >= MOD_POWER_LEVEL;
  wm._canEditCache = { value, expiry: now + CAN_EDIT_TTL_MS };
  return value;
}

export async function setRoomPowerLevels(wm, gmUserIds = []) {
  if (wm.isStandalone) return;

  try {
    await retryOnRateLimit(async () => {
      const result = await withRoomIdFallback(wm, (opts) =>
        wm.widgetApi.receiveStateEvents(EVENT_TYPES.POWER_LEVELS, opts)
      );
      if (!result.ok) throw result.error;
      const current = result.value?.[0]?.content;
      // Every room has a power_levels event. Writing levels computed
      // from an empty read would drop every existing user entry,
      // including the creator's 100.
      if (!current) throw new Error('power_levels read returned no events; refusing to overwrite');
      const next = computeNewPowerLevels(current, gmUserIds);
      await wm.sendStateEvent(EVENT_TYPES.POWER_LEVELS, '', next);
    });
  } catch (error) {
    showErrorNotification(
      new VTTError(ErrorType.NETWORK, `Could not set room power levels: ${error.message}`, error)
    );
  }
}

export async function inviteUser(wm, userId) {
  return wm.sendStateEvent(EVENT_TYPES.ROOM_MEMBER, userId, { membership: 'invite' });
}

export async function getPendingKnocks(wm) {
  if (wm.isStandalone || !wm.widgetApi) return [];
  const result = await withRoomIdFallback(wm, (opts) =>
    wm.widgetApi.receiveStateEvents(EVENT_TYPES.ROOM_MEMBER, opts)
  );
  if (!result.ok) return [];
  return (result.value ?? [])
    .filter((e) => e.content?.membership === 'knock')
    .map((e) => ({
      userId: e.state_key,
      displayname: e.content.displayname || e.state_key,
      reason: e.content.reason ?? '',
    }));
}

export async function setRoomDisplayName(wm, displayName) {
  let own = {};
  const result = await withRoomIdFallback(wm, (opts) =>
    wm.widgetApi.receiveStateEvents(EVENT_TYPES.ROOM_MEMBER, opts)
  );
  if (result.ok) {
    own = result.value?.find((e) => e.state_key === wm.userId)?.content ?? {};
  }
  return wm.sendStateEvent(EVENT_TYPES.ROOM_MEMBER, wm.userId, {
    ...own,
    membership: 'join',
    displayname: displayName,
  });
}

export async function kickUser(wm, userId, reason = 'Kicked by GM') {
  return wm.sendStateEvent(EVENT_TYPES.ROOM_MEMBER, userId, { membership: 'leave', reason });
}

export async function banUser(wm, userId, reason = 'Banned by GM') {
  return wm.sendStateEvent(EVENT_TYPES.ROOM_MEMBER, userId, { membership: 'ban', reason });
}

export async function getRoomMembers(wm) {
  if (wm.isStandalone || !wm.widgetApi) return [];

  try {
    const { memberEvents, callEvents } = await fetchMemberData(wm);
    const inCallIds = new Set(
      callEvents
        .filter((e) => Array.isArray(e.content?.['m.calls']) && e.content['m.calls'].length > 0)
        .map((e) => e.state_key)
    );

    return memberEvents
      .filter((e) => e.content?.membership === 'join')
      .map((e) => ({
        userId: e.state_key,
        displayname: e.content.displayname || e.state_key,
        inCall: inCallIds.has(e.state_key),
      }));
  } catch (error) {
    showErrorNotification(
      new VTTError(ErrorType.NETWORK, `Failed to get room members: ${error.message}`, error)
    );
    return [];
  }
}

async function fetchMemberData(wm) {
  const fetcher = async (opts) => {
    const [memberEvents, callEvents] = await Promise.all([
      wm.widgetApi.receiveStateEvents('m.room.member', opts),
      wm.widgetApi.receiveStateEvents('org.matrix.msc3401.call.member', opts).catch(() => []),
    ]);
    // A joined room always has at least our own member event; an empty
    // list means the scoped read was filtered, so report a miss and let
    // withRoomIdFallback retry without the room scope.
    if (!memberEvents || memberEvents.length === 0) return null;
    return { memberEvents, callEvents };
  };

  const result = await withRoomIdFallback(wm, fetcher);
  if (!result.ok) throw result.error;
  return result.value ?? { memberEvents: [], callEvents: [] };
}
