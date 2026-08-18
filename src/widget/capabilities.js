/**
 * Matrix widget capability list + power-level math.
 *
 * Kept data-only so tests can import it without the WidgetApiImpl runtime.
 */

import { EVENT_TYPES, VTT_EVENTS, YJS_EVENT_TYPES } from '../utils/constants.js';

export const RECEIVABLE_STATE_TYPES = [
  EVENT_TYPES.SETTINGS, EVENT_TYPES.MAP, EVENT_TYPES.FOG, EVENT_TYPES.INITIATIVE,
  EVENT_TYPES.TOKEN, EVENT_TYPES.CHARACTER, EVENT_TYPES.NPC, EVENT_TYPES.ITEM,
  EVENT_TYPES.DRAWING, EVENT_TYPES.HANDOUT, EVENT_TYPES.TABLE,
  EVENT_TYPES.SPELL, EVENT_TYPES.TEMPLATE, EVENT_TYPES.WALL, EVENT_TYPES.LIGHT,
  EVENT_TYPES.UI_MODE,
];

const SENDABLE_STATE_TYPES = [...RECEIVABLE_STATE_TYPES];

const ROOM_METADATA_STATE_TYPES = [
  EVENT_TYPES.ROOM_NAME,
  'm.room.topic',
  EVENT_TYPES.POWER_LEVELS,
  EVENT_TYPES.ROOM_MEMBER,
  EVENT_TYPES.TOMBSTONE,
  'org.matrix.msc3401.call.member',
];

export function buildCapabilities() {
  return [
    'org.matrix.msc2762.request.openid',
    'org.matrix.msc2931.navigate',
    'org.matrix.msc3819.send.delayed_event',
    ...RECEIVABLE_STATE_TYPES.map((t) => `org.matrix.msc2762.receive.state_event:${t}`),
    ...SENDABLE_STATE_TYPES.map((t) => `org.matrix.msc2762.send.state_event:${t}`),
    `org.matrix.msc2762.receive.event:${EVENT_TYPES.ROOM_MESSAGE}`,
    `org.matrix.msc2762.send.event:${EVENT_TYPES.ROOM_MESSAGE}`,
    'org.matrix.msc2762.receive.event:m.reaction',
    'org.matrix.msc2762.send.event:m.reaction',
    `org.matrix.msc2762.receive.event:${EVENT_TYPES.DAMAGE_EVENT}`,
    `org.matrix.msc2762.send.event:${EVENT_TYPES.DAMAGE_EVENT}`,
    `org.matrix.msc2762.receive.event:${EVENT_TYPES.PING}`,
    `org.matrix.msc2762.send.event:${EVENT_TYPES.PING}`,
    ...ROOM_METADATA_STATE_TYPES.map((t) => `org.matrix.msc2762.receive.state_event:${t}`),
    `org.matrix.msc2762.send.state_event:${EVENT_TYPES.ROOM_MEMBER}`,
    `org.matrix.msc2762.send.state_event:${EVENT_TYPES.POWER_LEVELS}`,
    // Yjs CRDT transport: all entity state rides in these. Without
    // them the widget can neither load nor publish the room snapshot.
    `org.matrix.msc2762.receive.state_event:${YJS_EVENT_TYPES.SNAPSHOT}`,
    `org.matrix.msc2762.send.state_event:${YJS_EVENT_TYPES.SNAPSHOT}`,
    `org.matrix.msc2762.receive.event:${YJS_EVENT_TYPES.UPDATE}`,
    `org.matrix.msc2762.send.event:${YJS_EVENT_TYPES.UPDATE}`,
    `org.matrix.msc2762.receive.event:${YJS_EVENT_TYPES.SYNC_VECTOR}`,
    `org.matrix.msc2762.send.event:${YJS_EVENT_TYPES.SYNC_VECTOR}`,
  ];
}

/**
 * Probe individual capabilities and emit `vtt:capabilities-denied` if any were
 * refused. Returns the missing list (empty when all granted).
 */
export function verifyCapabilities(widgetApi, required) {
  const missing = required.filter((cap) => !widgetApi.hasCapabilities([cap]));
  if (missing.length > 0) {
    window.dispatchEvent(
      new CustomEvent(VTT_EVENTS.CAPABILITIES_DENIED, { detail: { missing } })
    );
  }
  return missing;
}

export function requiredSendCapabilities() {
  return [
    `org.matrix.msc2762.send.state_event:${EVENT_TYPES.SETTINGS}`,
    `org.matrix.msc2762.send.state_event:${EVENT_TYPES.TOKEN}`,
    `org.matrix.msc2762.receive.state_event:${EVENT_TYPES.SETTINGS}`,
    `org.matrix.msc2762.receive.state_event:${EVENT_TYPES.TOKEN}`,
  ];
}

const GM_ONLY_EVENT_LEVELS = {
  [EVENT_TYPES.SETTINGS]: 50,
  [EVENT_TYPES.MAP]: 50,
  [EVENT_TYPES.FOG]: 50,
  [EVENT_TYPES.WALL]: 50,
  [EVENT_TYPES.LIGHT]: 50,
  [EVENT_TYPES.NPC]: 50,
  [EVENT_TYPES.HANDOUT]: 50,
  [EVENT_TYPES.TABLE]: 50,
  [EVENT_TYPES.SPELL]: 50,
  [EVENT_TYPES.UI_MODE]: 50,
  [YJS_EVENT_TYPES.SNAPSHOT]: 50,
};

const PLAYER_EVENT_LEVELS = {
  [EVENT_TYPES.TOKEN]: 0,
  [EVENT_TYPES.CHARACTER]: 0,
  [EVENT_TYPES.INITIATIVE]: 0,
  [EVENT_TYPES.ITEM]: 0,
  [EVENT_TYPES.DRAWING]: 0,
  [EVENT_TYPES.TEMPLATE]: 0,
  [EVENT_TYPES.ROOM_MESSAGE]: 0,
  [YJS_EVENT_TYPES.UPDATE]: 0,
  [YJS_EVENT_TYPES.SYNC_VECTOR]: 0,
};

/**
 * Produce an updated power-levels content object that promotes GMs to 50 and
 * assigns the GM/player event thresholds. Non-destructive: unknown fields on
 * `current` pass through untouched.
 */
export function computeNewPowerLevels(current, gmUserIds) {
  const users = { ...current.users };
  const defaultLevel = current.users_default ?? 0;
  for (const gmId of gmUserIds) {
    if ((users[gmId] ?? defaultLevel) < 50) users[gmId] = 50;
  }
  return {
    ...current,
    users,
    events: {
      ...current.events,
      ...GM_ONLY_EVENT_LEVELS,
      ...PLAYER_EVENT_LEVELS,
    },
    state_default: current.state_default ?? 50,
  };
}
