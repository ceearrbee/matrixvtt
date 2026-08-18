/**
 * scene-mode.js - start / leave / persist the active scene-thread.
 *
 * A "scene" is a long-running Matrix thread the user explicitly opens
 * for play-by-post-style group narration. The opening event uses a
 * vanilla m.room.message (msgtype m.notice) carrying a custom
 * `com.vtt.scene_root: true` flag so the VTT can render it with chapter
 * chrome; foreign Matrix clients ignore the flag and render the post
 * as a regular thread root in their existing thread UI.
 *
 * While a scene is active (`activeSceneSignal.value !== null`) every
 * non-whisper chat send threads under the scene root. See
 * `src/ui/chat-send.js` for the relation wiring.
 */

import { activeSceneSignal } from '../state/ui-signals.js';
import { renderMarkdown } from '../utils/renderMarkdown.js';
import { esc } from '../utils/domHelpers.js';
import { logger } from '../utils/logger.js';
import { formatSceneRootBody, isLongBody } from './chat-log-format.js';

const STORAGE_PREFIX = 'vtt:active-scene:';

/** @returns {string|null} */
function storageKey(roomId) {
  return roomId ? `${STORAGE_PREFIX}${roomId}` : null;
}

export function persistActiveScene(roomId, scene) {
  const key = storageKey(roomId);
  if (!key) return;
  try {
    if (scene) localStorage.setItem(key, JSON.stringify(scene));
    else localStorage.removeItem(key);
  } catch { /* private mode */ }
}

export function loadActiveScene(roomId) {
  const key = storageKey(roomId);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.eventId === 'string' && typeof parsed.title === 'string') {
        return parsed;
      }
    }
  } catch { /* private mode / parse error */ }
  // One-shot legacy migration: pre-2026-05-19 builds wrote to
  // sessionStorage. Read it once on first hydrate and clear so the
  // next reload reads only from localStorage.
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    sessionStorage.removeItem(key);
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.eventId === 'string' && typeof parsed.title === 'string') {
      return parsed;
    }
  } catch { /* private mode / parse error */ }
  return null;
}

export function clearActiveScene(roomId) {
  persistActiveScene(roomId, null);
  activeSceneSignal.value = null;
}

/**
 * Hydrate `activeSceneSignal` from persisted storage on app boot.
 * Called once after the room id is known. Reads localStorage (primary)
 * with a fallback to sessionStorage for legacy state.
 */
export function restoreActiveScene(roomId) {
  const scene = loadActiveScene(roomId);
  activeSceneSignal.value = scene;
}

/**
 * Post a scene-root event and set it as the active scene.
 * @param {object} ui
 * @param {string} title
 * @param {string} openingPost markdown
 * @returns {Promise<{ eventId: string, title: string } | null>}
 */
export async function startScene(ui, title, openingPost) {
  const trimmedTitle = (title || '').trim();
  const trimmedPost  = (openingPost || '').trim();
  if (!trimmedTitle) {
    ui._toast?.('Scene title is required', 'error');
    return null;
  }
  const plainBody = trimmedPost
    ? `🎬 ${trimmedTitle}\n\n${trimmedPost}`
    : `🎬 ${trimmedTitle}`;
  const formattedBody = `<h3>🎬 ${esc(trimmedTitle)}</h3>${trimmedPost ? renderMarkdown(trimmedPost) : ''}`;
  const content = {
    msgtype: 'm.notice',
    body: plainBody,
    format: 'org.matrix.custom.html',
    formatted_body: formattedBody,
    'com.vtt.scene_root': true,
    'com.vtt.scene_title': trimmedTitle,
  };
  let res;
  try {
    res = await ui.state.sendRoomEvent('m.room.message', content);
  } catch (err) {
    logger.error('SceneMode', 'startScene send failed:', err);
    ui._toast?.(`Couldn't start scene: ${err.message}`, 'error');
    return null;
  }
  const eventId = res?.event_id;
  if (!eventId) {
    ui._toast?.("Couldn't start scene: no event id returned", 'error');
    return null;
  }
  const scene = { eventId, title: trimmedTitle };
  activeSceneSignal.value = scene;
  persistActiveScene(ui.state.widgetManager?.roomId, scene);

  // Local-echo the scene-root into the activity log. Inbound chat
  // (chat/timeline-intake.js) drops events sent by the local user to
  // avoid double-rendering, so without this the user who *started* the
  // scene wouldn't see the chapter chrome in their own log until a
  // round-trip via someone else's view. The shared formatter keeps
  // local-echo and remote-receive identical.
  const html = formatSceneRootBody(trimmedTitle, trimmedPost, {
    format: content.format,
    formatted_body: content.formatted_body,
  });
  ui._log?.('🎬', html, {
    eventId,
    sender: ui.state.widgetManager?.userId ?? null,
    isSceneRoot: true,
    sceneTitle: trimmedTitle,
    long: isLongBody(`${trimmedTitle}\n${trimmedPost}`),
  });

  return scene;
}

/** Leave the currently active scene (does not delete the thread). */
export function leaveScene(ui) {
  clearActiveScene(ui?.state?.widgetManager?.roomId);
}

/**
 * Re-enter an already-existing scene. No Matrix write - this just sets
 * the active-scene signal so subsequent non-whisper sends thread under
 * the given root, and persists the choice across reloads via
 * sessionStorage. Use this from the Scenes forum's "Enter" button.
 *
 * @param {object} ui
 * @param {string} eventId  Scene-root event id (must exist in the room).
 * @param {string} title    Display title for the chat banner.
 */
export function enterScene(ui, eventId, title) {
  if (!eventId || !title) return;
  const scene = { eventId, title };
  activeSceneSignal.value = scene;
  persistActiveScene(ui?.state?.widgetManager?.roomId, scene);
}
