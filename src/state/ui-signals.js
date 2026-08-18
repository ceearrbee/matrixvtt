/**
 * ui-signals.js - signals for ephemeral, non-Matrix UI state.
 *
 * Kept in a separate module from `signals.js` (domain state) so the
 * two concerns are visibly different: these do not round-trip
 * through Matrix; they are only propagation primitives for local
 * UI reactivity.
 */

import { signal } from '@preact/signals';
import { TABS, UI_MODES, STORAGE_KEYS, LAYOUT_MODES } from '../utils/constants.js';

/**
 * Debug-bar visibility. Backed by a signal (not just the localStorage
 * getter) so toggling re-renders the App reactively; a plain getter
 * read does not, because re-invoking the root render is a no-op when
 * no subscribed signal changed. Seeded from localStorage / ?debug=1.
 */
function _readDebugFlag() {
  try {
    return localStorage.getItem(STORAGE_KEYS.DEBUG) === '1'
      || new URLSearchParams(location.search).get('debug') === '1';
  } catch { return false; }
}
export const debugModeSignal = signal(_readDebugFlag());

/**
 * Monotonically-increasing version token bumped whenever
 * `ui.activityLog` is appended or cleared. Components that render
 * the log (DiceBar, LogPanel) read `.value` in render and rerender
 * automatically on change.
 */
export const logVersionSignal = signal(0);

export function bumpLogVersion() {
  logVersionSignal.value = logVersionSignal.value + 1;
}

/**
 * Currently-visible tab in the sheet panel. `tab-navigation.switchTab`
 * writes, `SheetPanel.jsx` reads.
 */
export const activeTabSignal = signal(TABS.SHEET);

/**
 * Per-user chrome layout preference (text | icon). `App` reads it to stamp
 * `data-layout` on the shell; `ui-mode.hydrateLayoutMode` / `setLayoutMode`
 * write it. Defaults to text so nothing changes until the user opts in.
 */
export const layoutModeSignal = /** @type {import('@preact/signals').Signal<'text' | 'icon'>} */ (
  signal(LAYOUT_MODES.TEXT)
);

/**
 * Selection state for the character and NPC sheets - not synced to
 * Matrix, but needs signal-driven rerendering so `NPCSheet.jsx` and
 * `CharacterSheet.jsx` refresh when the selection is cleared or
 * switched without a full-panel rerender.
 */
export const selectedCharacterIdSignal = signal(null);
export const selectedNPCIdSignal = signal(null);
export const speakAsSignal = signal('');

/**
 * Currently-selected token id. Backs `StateManager.selectedToken` so
 * the Sheet / NPC panels re-render when the user clicks a different
 * token on the map (or via context menu, preview, drag, etc.).
 * Without this signal, plain-property writes never woke Preact
 * subscribers - the deferred half of the "View Full Sheet" bug.
 */
export const selectedTokenSignal = signal(null);

/**
 * Whether the next dice roll is secret (GM-only result). Backs
 * `ui._secretRoll`. Toggled via the dice-bar lock button; consumed by
 * `fireRoll` / `fireFormulaRoll` in `src/ui/dice-helpers.js`.
 */
export const secretRollSignal = signal(false);

/**
 * Sync health for the header pill. True = "Live"; false = "Reconnecting".
 * Written by the Matrix sync lifecycle handlers in `lifecycle-init.js`;
 * read by `Header.jsx` and `sync/sync-banner.js`. Was a plain `ui._syncOk`
 * property - Header never re-rendered on flip; the imperative
 * updateSyncBadge() DOM-patched the button instead.
 */
export const syncOkSignal = signal(false);

/**
 * Pending Matrix write queue depth. Bumped by `vtt:queue-pending` /
 * `vtt:queue-empty` events. Read by `sync/ApiStatus.jsx` and
 * `sync/sync-banner.js`. Was a plain `ui._queueCount` property - ApiStatus
 * relied on a 1Hz tick to repaint stale values.
 */
export const queueCountSignal = signal(0);

/**
 * Unified sync-progress surface. One bar reflects whichever sync phase is
 * active - connecting/reconnecting, loading history, draining queued writes,
 * or saving live state. `total: 0` means indeterminate (animated bar, no %).
 * Aggregated by `ui/sync/sync-progress.js`; read by `ui/sync/SyncProgress.jsx`.
 * @type {import('@preact/signals').Signal<{active: boolean, label: string, done: number, total: number}>}
 */
export const syncProgressSignal = signal({ active: false, label: '', done: 0, total: 0 });

/**
 * Active theme name: 'auto' | 'light' | 'dark' | 'high-contrast'.
 * Mirrors `document.documentElement[data-theme]` (default 'auto' when
 * the attribute is absent). `restoreTheme` / `toggleTheme` in
 * `src/ui/theme.js` write through to this signal so the Header's
 * tooltip + icon refresh reactively when the theme changes.
 */
export const themeSignal = signal('auto');

/**
 * Reply-in-thread context for the chat input. When non-null the next
 * outgoing message will carry m.relates_to with rel_type='m.thread'.
 * Shape: { rootEventId: string, rootSender: string, rootPreview: string } | null
 */
export const replyContextSignal = signal(null);

/**
 * Open floating doc panels (handouts + pages). Each entry:
 *   { key: '<kind>:<id>', kind: 'handout' | 'page', id, z }
 * Multiple may be open at once. `z` orders the stack - clicking a
 * panel bumps it to the front via `_maxZ + 1`.
 *
 * `ui.openDoc(kind, id)` / `ui.closeDoc(key)` / `ui.bringDocToFront(key)`
 * write; `App.jsx` reads to render the FloatingDocs host.
 */
export const openDocsSignal = signal(/** @type {Array<{key: string, kind: 'handout'|'page', id: string, z: number}>} */ ([]));

/**
 * Active "scene" the chat input is currently posting into. While set,
 * every non-whisper send carries `m.relates_to: { rel_type: 'm.thread',
 * event_id: <eventId> }` so the post lands under the scene root in
 * foreign Matrix clients (Element / Element X / FluffyChat). Whispers
 * always escape the scene to preserve recipient-only delivery.
 *
 * Persisted to sessionStorage keyed by room id by `src/ui/scene-mode.js`
 * so a refresh keeps the user in-scene.
 *
 * Shape: { eventId: string, title: string } | null
 */
export const activeSceneSignal = signal(/** @type {{eventId: string, title: string} | null} */ (null));

/**
 * Chat speaking mode. Drives both the outgoing msgtype and the log/render
 * styling:
 *   - 'say'      → m.text (existing behaviour) - supports tone + persona
 *   - 'describe' → m.emote (third-person action) - supports persona
 *   - 'ooc'      → m.notice (out-of-character) - no persona, no tone
 *
 * Session-scoped; not persisted across reloads.
 */
export const chatModeSignal = signal('say');

/**
 * Selected tone for Say-mode messages. Shape: { name, color? } | null.
 * When set, outgoing bodies are prefixed `[Name] body` and the event
 * carries a `com.vtt.tone` field with the colour metadata. Hidden /
 * ignored in Describe and OOC modes.
 *
 * Session-scoped; stays sticky across sends until the user clears or
 * picks a different tone.
 */
export const chatToneSignal = signal(null);

/**
 * Active channel the conversation-first shell is currently focused on.
 * Written by `ChannelsRail.jsx` (the left rail in the new shell);
 * consumers (LogContainer, SheetPanel) read it to decide which surface
 * to render in the centre column.
 *
 * Values are flat strings so the rail can publish anything it wants
 * without consumers needing a tagged-union match:
 *   - 'live'             → live chronological chat
 *   - 'scene:<eventId>'  → a specific scene thread
 *   - 'notes:handouts'   → handouts list
 *   - 'notes:pages'      → pages list
 *
 * The signal itself is the in-memory mirror of the per-(user, room)
 * localStorage stamp `vtt-channels-rail:<userId>:<roomId>`; the rail
 * hydrates it on mount and writes through on change.
 */
export const activeChannelSignal = signal('live');

/**
 * Table phase - the shared fiction state, 'narrative' | 'combat'. Driven
 * by initiative (combat when an order is active), overridable, and
 * suggested across the table by the GM. Persisted per-(user, room).
 */
export const tablePhaseSignal = signal(/** @type {'narrative' | 'combat'} */ (UI_MODES.NARRATIVE));

/**
 * GM-only prep workspace toggle. Session-scoped (not persisted, not
 * broadcast). Ignored for non-GM clients. When true (and GM), the right
 * rail shows the management workspace regardless of phase.
 */
export const gmPrepActiveSignal = signal(false);

/** Session-only: did the user manually set the phase? Suppresses auto-switch. */
export const phaseManuallyOverriddenSignal = signal(false);

/**
 * Active mobile pane (≤768px only). Drives the bottom tab bar: exactly one
 * shell surface fills the main area at a time. Mirrored to
 * `data-mobile-pane` on `.shell` by App.jsx; the matching CSS lives in the
 * mobile @media block, so this signal is inert on desktop.
 *   - 'chat'    - the conversation log (default)
 *   - 'map'     - the Konva map, full pane
 *   - 'panel'   - the right rail (Sheet / Combat sidebar / Party, by mode)
 *   - 'journal' - the left IconRail (channels / scenes / journal / GM)
 * Session-only (not persisted) - a fresh load starts on Chat.
 */
export const mobilePaneSignal = signal(
  /** @type {'chat' | 'map' | 'panel' | 'journal'} */ ('chat'),
);

/**
 * Last suggested mode broadcast by the GM via the `m.vtt.mode` Matrix
 * state event. `null` means no outstanding suggestion. When set AND
 * different from `tablePhaseSignal.value`, `SuggestedModeBanner` renders a
 * non-blocking "GM suggests X - Follow / Stay" banner. Dismissing
 * Follow calls `setPhase`; dismissing Stay clears this signal.
 *
 * Echo-suppressed: a GM's own broadcast is filtered by sender in the
 * syncer-apply path, so the GM does not get banner-spammed by their
 * own selection.
 */
export const suggestedModeSignal = signal(/** @type {string | null} */ (null));

/**
 * Session-only flag: has the user manually picked a sheet tab this
 * session? When false, switching UI mode retargets `activeTabSignal`
 * to the mode's default (narrative → Notes, gm-prep → NPC). The first
 * `switchTab` call flips this true so the mode effect stops overriding
 * the user's pick. Intentionally not persisted - a fresh page load
 * re-opens the door to mode-driven defaults.
 */
export const tabManuallyChosenSignal = signal(false);

/**
 * Currently-open IconRail drawer, or null when the rail is collapsed
 * to icons-only. Values come from `ICON_RAIL_DRAWERS`:
 *   'scenes' | 'journal' | 'npcs' | 'items' | 'maps' | 'menu' | null
 *
 * Persisted per-(user, room) via sessionStorage with prefix
 * `STORAGE_KEY_PREFIXES.ICON_RAIL_DRAWER`. Hydration on user/room-known
 * boot from `src/ui/ui-mode.js`'s lifecycle wiring; modes also set a
 * default-open drawer (Narrative → journal, GM Prep → scenes) via the
 * `defaultDrawerFor` helper unless the user has manually picked.
 */
export const openIconRailDrawerSignal = signal(/** @type {string | null} */ (null));

/**
 * Session-only flag mirroring `tabManuallyChosenSignal` for the rail:
 * once the user manually toggles a drawer, mode changes stop opening a
 * default drawer over their pick.
 */
export const drawerManuallyChosenSignal = signal(false);

/**
 * Active toolbar tool group in MapStrip - one of TOOL_GROUPS values.
 * Defaults to navigation; persisted per-(user, room) via sessionStorage
 * with prefix `STORAGE_KEY_PREFIXES.TOOL_GROUP`.
 */
export const activeToolGroupSignal = signal('navigation');

// GM/player power-level split failed during setup. Holds the intended
// gm id list so the GM panel can retry; null = healthy.
export const plSplitFailedSignal = signal(/** @type {string[] | null} */ (null));
