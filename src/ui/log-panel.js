/**
 * log-panel.js - activity-log producers + transport helpers. Preact
 * `LogPanel.jsx` owns the rendered tree; this file only writes entries
 * and exposes the history-replay path.
 */

import { EVENT_TYPES } from '../utils/constants.js';
import { bumpLogVersion } from '../state/ui-signals.js';
import { CHAT_MSGTYPES } from '../chat/timeline-intake.js';
import { logger } from '../utils/logger.js';
import { setSyncPhase } from './sync/sync-progress.js';

const MAX_LOG_ENTRIES = 2000;

/**
 * Add an entry to the activity log.
 *
 * Used to also auto-switch to the Log tab. That was disorienting and
 * actively harmful: an action initiated on the GM tab (rolling a loot
 * table) would yank the user to Log mid-click, letting the follow-up
 * land on whatever the Log placed under the cursor - including the
 * per-entry "+" reaction button, which opens the emoji picker. The
 * Log tab is reachable on demand; entries accrue silently meanwhile.
 *
 * Pass `opts` with `{ eventId, sender }` for Matrix-backed entries so
 * the rendering layer can attribute reactions to the right message.
 * Synthesised entries (dice, combat, etc.) omit opts and get null
 * fields.
 */
export function log(ui, icon, html, opts = {}) {
  const eventId = opts.eventId ?? null;
  // Matrix-backed entries dedupe by event_id. Two distinct code paths
  // can both reach log() for the same event - chat-send's local echo
  // after a successful send, plus the sync-echo path through
  // _onChat - and one of them may double-fire when the filter for
  // "own message" misses (e.g. mismatched userId normalization).
  // Synthetic entries (dice, combat, etc.) leave eventId null and
  // never collide.
  if (eventId && ui._seenLogEventIds?.has(eventId)) return;
  if (eventId && ui._seenLogEventIds) ui._seenLogEventIds.add(eventId);

  const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const text = html.replace(/<[^>]+>/g, '');
  const entry = {
    icon, html, text, ts, eventId,
    sender: opts.sender ?? null,
    threadOf: opts.threadOf ?? null,
    isSceneRoot: !!opts.isSceneRoot,
    sceneTitle: opts.sceneTitle ?? null,
    long: !!opts.long,
  };
  ui.activityLog.unshift(entry);
  _trimLog(ui);
  bumpLogVersion();
}

// Keep activityLog within MAX_LOG_ENTRIES AND prune the dedup set in lock-step
// - otherwise `_seenLogEventIds` grows unbounded across a long session even
// though the log itself is capped.
function _trimLog(ui) {
  while (ui.activityLog.length > MAX_LOG_ENTRIES) {
    const removed = ui.activityLog.pop();
    if (removed?.eventId) ui._seenLogEventIds?.delete(removed.eventId);
  }
}

export async function loadMoreHistory(ui) {
  const api = ui.widgetManager?.getApi?.();
  if (!api?.getMessages || api.hasMoreHistory === false || ui._logLoadingHistory) return;

  ui._logLoadingHistory = true;
  bumpLogVersion();

  try {
    const { chunk } = await api.getMessages(100);
    const validMessages = (chunk ?? [])
      .filter((e) => e.type === EVENT_TYPES.ROOM_MESSAGE && CHAT_MSGTYPES.has(e.content?.msgtype))
      .filter((e) => !ui._seenLogEventIds.has(e.event_id));
    _processHistoricalMessages(ui, validMessages);
  } finally {
    ui._logLoadingHistory = false;
    bumpLogVersion();
  }
}

// Pull one filtered page of chat history into the activity log.
async function _loadChatPage(ui, api) {
  const { chunk } = await api.getChatMessages(100);
  const validMessages = (chunk ?? [])
    .filter((e) => e.type === EVENT_TYPES.ROOM_MESSAGE && CHAT_MSGTYPES.has(e.content?.msgtype))
    .filter((e) => !ui._seenLogEventIds.has(e.event_id));
  _processHistoricalMessages(ui, validMessages);
  bumpLogVersion();
}

/**
 * Page backwards until enough real chat/scene entries surface.
 *
 * Preferred path: `api.getChatMessages` - a server-side-filtered
 * m.room.message fetch, so one request returns a full page of real chat
 * even though the timeline is flooded with `com.matrixvtt.yjs.update`
 * events. Fallback (api without the method): unfiltered scrollback via
 * `loadMoreHistory`, paging past the Yjs noise under a request budget.
 */
export async function backfillRecentHistory(ui, { minEntries = 25, maxPages = 12 } = {}) {
  const api = ui.widgetManager?.getApi?.();
  const filtered = typeof api?.getChatMessages === 'function';
  if (!filtered && !api?.getMessages) return;

  const hasMore = () => (filtered ? api.hasMoreChatHistory !== false : api.hasMoreHistory !== false);

  let pages = 0;
  try {
    while (hasMore() && pages < maxPages && ui.activityLog.length < minEntries) {
      // Progress is page-based, not entry-based: in a Yjs-heavy room the
      // entry count stalls for many pages while the paging itself advances.
      setSyncPhase('history', { label: `Loading history - page ${pages + 1} of ${maxPages}…`, done: pages, total: maxPages });
      const before = ui.activityLog.length;
      if (filtered) await _loadChatPage(ui, api);
      else await loadMoreHistory(ui);
      pages++;
      // Reached the room start with this page adding nothing - done.
      if (ui.activityLog.length === before && !hasMore()) break;
    }
  } finally {
    setSyncPhase('history', null);
  }

  if (pages >= maxPages && ui.activityLog.length < minEntries) {
    logger.warn('log-panel',
      `history backfill hit the ${maxPages}-page budget with ${ui.activityLog.length}/${minEntries} entries - room timeline is Yjs-heavy`);
    const text = 'Older messages are unavailable - the room timeline is dominated by sync data.';
    ui.activityLog.push({
      icon: 'ℹ', html: text, text, ts: '', eventId: null,
      sender: null, threadOf: null, isSceneRoot: false, sceneTitle: null, long: false,
    });
    bumpLogVersion();
  }
}

function _processHistoricalMessages(ui, messages) {
  for (const e of messages.reverse()) {
    ui._seenLogEventIds.add(e.event_id);
    const body = e.content.body ?? '';
    const sender = e.sender?.split(':')[0]?.replace('@', '') ?? e.sender;
    const ts = e.origin_server_ts
      ? new Date(e.origin_server_ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    const text = `${sender}: ${body}`;
    const rel = e.content?.['m.relates_to'];
    const threadOf = rel?.rel_type === 'm.thread' && rel.event_id ? rel.event_id : null;
    // Preserve VTT-specific metadata so prior-session scenes show up
    // in the IconRail Scenes drawer after a fresh page load. The live
    // intake path (src/chat/timeline-intake.js) already extracts the
    // same fields - keep parity here for the backfill path.
    const isSceneRoot = e.content?.['com.vtt.scene_root'] === true;
    const sceneTitle = e.content?.['com.vtt.scene_title'] ?? null;
    ui.activityLog.push({
      icon: '💬',
      html: `<b>${_esc(sender)}</b>: ${_esc(body)}`,
      text, ts,
      eventId: e.event_id ?? null,
      sender: e.sender ?? null,
      threadOf,
      isSceneRoot,
      sceneTitle,
    });
  }
  _trimLog(ui);
}

function _esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Map a sender's Matrix user ID to a token ID via their claimed character. */
export function findTokenForSender(ui, userId) {
  for (const [charId, char] of ui.state.characters) {
    if (char.claimed_by_user_id === userId) {
      for (const [tokenId, token] of ui.state.tokens) {
        if (token.sheet_id === charId) return tokenId;
      }
    }
  }
  return null;
}
