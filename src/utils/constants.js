/**
 * MatrixVTT Global Constants
 */

// Replaced at build time by Vite/Vitest `define`. Falls back to 'dev'
// when bundling is bypassed (e.g. a raw Node import).
export const BUILD_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

export const STORAGE_KEYS = {
  DEBUG: 'vtt:debug',
  THEME: 'vtt-theme',
  ANNOUNCEMENTS: 'mvtt_announcements',
  RETRY_QUEUE: 'vtt:retry-queue',
  AUTH_SESSION: 'vtt-auth-session',
  RECENT_SESSIONS: 'vtt-recent-sessions',
  ACCESSIBILITY: 'vtt:accessibility',
  COMBAT_AUTOMATION: 'vtt:combat-automation',
  HIDE_MAP_HELP: 'vtt:hide-map-help',
  DICE_MACROS: 'vtt:dice-macros',
  TOUR_COMPLETED: 'mxvtt:tour-completed',
  // Legacy key from the removed step-modal tutorial; read only so old
  // completions still count, never written.
  TUTORIAL_COMPLETED: 'vtt-tutorial-completed',
  ACTIVE_ROOM: 'vtt:active-room',
  // Active UI mode (combat | narrative | gm-prep). Base key; per-room
  // storage builds `${UI_MODE}:${roomId}` and then user-scopes via
  // readUserScoped, so final key is `vtt:ui-mode:${roomId}::${userId}`.
  UI_MODE: 'vtt:ui-mode',
  // Cached room id of the user's personal library, user-scoped via
  // readUserScoped so it survives a different account logging in.
  LIBRARY_ROOM: 'vtt:library-room',
  // Per-user chrome layout preference (text | icon). User-scoped via
  // readUserScoped; a personal viewing choice, never synced to the room.
  LAYOUT_MODE: 'vtt:layout-mode',
  // Unsent Yjs updates awaiting retry; room-scoped as `${key}:${roomId}`.
  YJS_PENDING: 'vtt:yjs-pending'
};

// Canonical UI mode names. The shell reads `tablePhaseSignal` and sets
// `data-ui-mode="<value>"` on the .shell root; CSS selectors keyed off
// that attribute drive per-mode layout, widths, and visibility.
// GM_PREP is a legacy value used only for migration (hydratePhase) and
// backward-compat suggestion handling.
export const UI_MODES = Object.freeze({
  COMBAT: 'combat',
  NARRATIVE: 'narrative',
  GM_PREP: 'gm-prep',
});

export const UI_MODE_VALUES = /** @type {readonly string[]} */ (
  Object.freeze(Object.values(UI_MODES))
);

/**
 * Type predicate: narrows `unknown` to a valid UI mode string.
 * @param {unknown} v
 * @returns {v is 'combat' | 'narrative' | 'gm-prep'}
 */
export function isUiMode(v) {
  return typeof v === 'string' && UI_MODE_VALUES.includes(v);
}

// Chrome layout modes. `App` stamps `data-layout="<value>"` on the .shell
// root; CSS keyed off it flips the text index/tabs to the icon-only rail
// and icon tabs. `text` is the default so existing users are unaffected.
export const LAYOUT_MODES = Object.freeze({
  TEXT: 'text',
  ICON: 'icon',
});

const LAYOUT_MODE_VALUES = /** @type {readonly string[]} */ (
  Object.freeze(Object.values(LAYOUT_MODES))
);

/**
 * @param {unknown} v
 * @returns {v is 'text' | 'icon'}
 */
export function isLayoutMode(v) {
  return typeof v === 'string' && LAYOUT_MODE_VALUES.includes(v);
}

// Per-(user, room) localStorage namespaces - keys are built as
// `${prefix}${userId}:${roomId}`. Centralized so cleanup (e.g.
// logout sweeps) can iterate without hardcoding the prefix strings.
export const STORAGE_KEY_PREFIXES = Object.freeze({
  MAP_STRIP: 'vtt-map-strip:',
  CHANNELS_RAIL: 'vtt-channels-rail:',
  ICON_RAIL_DRAWER: 'vtt-icon-rail-drawer:',
  TOOL_GROUP: 'vtt-tool-group:',
});

// IconRail drawer identifiers - values written to per-(user, room)
// sessionStorage and read by IconRail to restore which drawer was
// open on the last visit. `null` is "drawer closed".
export const ICON_RAIL_DRAWERS = Object.freeze({
  SCENES:  'scenes',
  JOURNAL: 'journal',
  NPCS:    'npcs',
  ITEMS:   'items',
  MAPS:    'maps',
  MENU:    'menu',
});

// MapStrip toolbar groups. The active group filters which tools are
// visible; persisted per-(user, room).
export const TOOL_GROUPS = Object.freeze({
  NAVIGATION:  'navigation',
  MEASUREMENT: 'measurement',
  DRAWING:     'drawing',
  GM:          'gm',
});

// Channels rail / centre-column routing. Values are the strings
// written to localStorage and read by LogContainer / ChannelsRail.
export const CHANNEL_KEYS = Object.freeze({
  LIVE: 'live',
  SCENE_PREFIX: 'scene:',
  NOTES_HANDOUTS: 'notes:handouts',
  NOTES_PAGES: 'notes:pages',
});

// Plain-text msgtype on m.room.message events. The event type itself
// is already `EVENT_TYPES.ROOM_MESSAGE`.
export const ROOM_MESSAGE_MSGTYPE_TEXT = 'm.text';

export const ENTITY_TYPES = {
  PC: 'pc',
  NPC: 'npc'
};

/**
 * Canonical toast levels.
 *
 * @typedef {'info' | 'success' | 'warn' | 'warning' | 'error'} ToastLevel
 */
export const TOAST_LEVEL = Object.freeze({
  INFO: 'info',
  SUCCESS: 'success',
  WARN: 'warn',
  ERROR: 'error',
});


// Initiative resolution modes configurable per ruleset / per session.
export const INITIATIVE_MODES = {
  INDIVIDUAL: 'individual', // each combatant rolls (classic d20)
  SIDE:       'side',       // one roll per side; tokens on same side share init
  STATIC:     'static'      // sort by tie_break_stat, no roll
};

// Token side for side-based initiative and visual tagging.
export const DISPOSITIONS = {
  FRIENDLY: 'friendly',
  HOSTILE:  'hostile',
  NEUTRAL:  'neutral'
};

export const EVENT_TYPES = {
  SETTINGS: 'com.vtt.settings',
  MAP: 'com.vtt.map',
  FOG: 'com.vtt.fog',
  INITIATIVE: 'com.vtt.initiative',
  TOKEN: 'com.vtt.token',
  CHARACTER: 'com.vtt.character',
  NPC: 'com.vtt.npc',
  ITEM: 'com.vtt.item',
  SPELL: 'com.vtt.spell',
  DRAWING: 'com.vtt.drawing',
  HANDOUT: 'com.vtt.handout',
  PAGE: 'com.vtt.page',
  TABLE: 'com.vtt.table',
  PIN: 'com.vtt.pin',
  PING: 'com.vtt.ping',
  TEMPLATE: 'com.vtt.template',
  WALL: 'com.vtt.wall',
  LIGHT: 'com.vtt.light',
  ROOM_NAME: 'm.room.name',
  ROOM_MEMBER: 'm.room.member',
  ROOM_MESSAGE: 'm.room.message',
  POWER_LEVELS: 'm.room.power_levels',
  TOMBSTONE: 'm.room.tombstone',
  SPEAK_AS_TOKEN: 'com.vtt.speak_as_token',
  // Custom message-content field carrying the chosen tone for Say-mode
  // chat. Value shape: { name: string, color?: string }. The bracket
  // prefix in `body` is the authoritative render; this field is metadata
  // so clients can colour-tint the entry.
  TONE: 'com.vtt.tone',
  DAMAGE_EVENT: 'com.vtt.damage_event',
  // Whisper: timeline event for private out-of-character chat. The
  // sender targets a user-id list via `to: [mxid, …]`; the receiver
  // filters incoming whispers to messages where the local user is
  // in the `to` list OR they're the sender.
  WHISPER: 'com.vtt.whisper',
  // GM-suggested UI mode broadcast. Empty state_key (one per room).
  // Content: { mode: 'combat' | 'narrative' | 'gm-prep' }.
  // The local GM's own broadcast is echo-suppressed on the receive path.
  UI_MODE: 'com.vtt.ui_mode',
  // Personal content library. LIBRARY_MARKER (empty state_key) tags a room
  // as a user's library; LIBRARY_ENTRY holds one reusable entry per
  // state_key. Both live in a dedicated library room, never a campaign room.
  LIBRARY_MARKER: 'com.vtt.library',
  LIBRARY_ENTRY: 'com.vtt.library_entry',
};

// Content kinds a library entry can hold. Values match the entity noun used
// by the insert/save flows; do not reuse EVENT_TYPES strings here.
export const LIBRARY_KIND = Object.freeze({
  CHARACTER: 'character',
  NPC:       'npc',
  ITEM:      'item',
  SPELL:     'spell',
  MAP:       'map',
  RULESET:   'ruleset',
});

// Matrix caps a state event near 64KB; stay clear so headers/signatures fit.
export const LIBRARY_ENTRY_MAX_BYTES = 60000;

// Yjs CRDT transport: UPDATE and SYNC_VECTOR are timeline events,
// SNAPSHOT is a chunked state event (GM-only, PL 50).
export const YJS_EVENT_TYPES = {
  UPDATE: 'com.matrixvtt.yjs.update',
  SNAPSHOT: 'com.matrixvtt.yjs.snapshot',
  SYNC_VECTOR: 'com.matrixvtt.yjs.sync_vector',
};

export const PAGE_KINDS = Object.freeze({
  JOURNAL: 'journal',
  LORE:    'lore',
  FICTION: 'fiction',
  PREP:    'prep',
});

export const PAGE_VISIBILITY = Object.freeze({
  PRIVATE: 'private',
  GM:      'gm',
  PLAYERS: 'players',
});

export const VTT_EVENTS = {
  UPDATE: 'vtt:update',
  FULL: 'full',
  DICE_ROLL_RESULT: 'vtt:dice-roll-result',
  DAMAGE: 'vtt:damage',
  HEAL: 'vtt:heal',
  VIEW_SHEET: 'vtt:view-sheet',
  ERROR: 'vtt:error',
  CHAT_MESSAGE: 'vtt:chat-message',
  SESSION_RESET: 'vtt:session-reset',
  RATE_LIMITED: 'vtt:rate-limited',
  QUEUE_PENDING: 'vtt:queue-pending',
  QUEUE_EMPTY: 'vtt:queue-empty',
  SYNC_ERROR: 'vtt:sync-error',
  SYNC_RECOVERED: 'vtt:sync-recovered',
  SYNC_DEAD: 'vtt:sync-dead',
  LEAVE_ROOM: 'vtt:leave-room',
  RETURN_TO_ROOMS: 'vtt:return-to-rooms',
  DELETE_SESSION: 'vtt:delete-session',
  CAPABILITIES_DENIED: 'vtt:capabilities-denied',
  ROOM_UPGRADED: 'vtt:room-upgraded'
};

export const TABS = {
  NPC: 'npc',
  SHEET: 'sheet',
  LOG: 'log',
  NOTES: 'notes',
  SETTINGS: 'settings',
  MAPS: 'maps',
  DRAWING: 'drawing',
  ITEMS: 'items',
  SPELLS: 'spells',
  SKILLS: 'skills',
  COMBAT: 'combat',
  PAGES: 'pages',
  PARTY: 'party',
  GM: 'gm'
};

export const DEFAULTS = {
  GRID_PX: 40,
  SYSTEM: 'generic',
  DEBOUNCE_DELAY: 400
};
