/**
 * timeline-intake.js - incoming Matrix timeline events routed to the
 * right side effects: typing banner, ping overlay, damage log, chat
 * message display, and dice-command execution.
 */

import { EVENT_TYPES, VTT_EVENTS } from '../utils/constants.js';
import { parseDiceRollCommand, executeDiceRollFromChat } from './dice-command.js';
import { reactionsSignal } from '../state/signals.js';

export async function handleTimelineEvent(chat, event) {
  if (event.type === 'm.reaction') return _handleReaction(chat, event);
  if (event.type === EVENT_TYPES.PING) return _handlePing(chat, event);
  if (event.type === EVENT_TYPES.DAMAGE_EVENT) return _handleDamage(chat, event);
  if (event.type === EVENT_TYPES.WHISPER) return _handleWhisper(chat, event);
  if (event.type === EVENT_TYPES.ROOM_MESSAGE) return _handleRoomMessage(chat, event);
}

function _handleReaction(chat, event) {
  const rel = event?.content?.['m.relates_to'];
  if (rel?.rel_type !== 'm.annotation' || !rel.event_id || !rel.key) return;

  const targetId = rel.event_id;
  const key = rel.key;
  const sender = event.sender;
  const myUserId = chat.clientManager?.userId;

  const prev = reactionsSignal.value.get(targetId) ?? [];
  const existing = prev.find((e) => e.key === key);

  let next;
  if (!existing) {
    const entry = { key, count: 1, senders: [sender] };
    if (sender === myUserId) entry.myReactionEventId = event.event_id;
    next = [...prev, entry];
  } else if (existing.senders.includes(sender)) {
    next = prev; // already recorded - no change
  } else {
    next = prev.map((e) => {
      if (e.key !== key) return e;
      const updated = { ...e, count: e.count + 1, senders: [...e.senders, sender] };
      if (sender === myUserId) updated.myReactionEventId = event.event_id;
      return updated;
    });
  }

  if (next !== prev) {
    const newMap = new Map(reactionsSignal.value);
    newMap.set(targetId, next);
    reactionsSignal.value = newMap;
  }
}

/**
 * Whisper: a private timeline event addressed to one or more user
 * ids. The receiver shows it only if the local user is the sender
 * or appears in the `to` list. Non-VTT Matrix clients see this as
 * an opaque com.vtt.whisper event with no body rendered - the
 * privacy guarantee is that only opted-in clients render it.
 */
function _handleWhisper(chat, event) {
  const c = event.content ?? {};
  const sender = event.sender;
  const myUserId = chat.clientManager?.userId;
  const to = Array.isArray(c.to) ? c.to : [];
  const isParticipant = sender === myUserId || to.includes(myUserId);
  if (!isParticipant) return;
  // Don't duplicate the local echo - sender already saw the
  // outgoing message in their UI at send time.
  if (sender === myUserId) return;
  if (!c.body) return;
  window.dispatchEvent(new CustomEvent(VTT_EVENTS.CHAT_MESSAGE, {
    detail: {
      sender,
      body: c.body,
      whisperTo: to,
      isWhisper: true,
      historical: event._historical === true,
    },
  }));
}

function _handlePing(chat, event) {
  // Skip own echo - we already rendered locally at broadcast time.
  const myUserId = chat.clientManager?.userId;
  if (event.sender && event.sender === myUserId) return;
  const c = event.content ?? {};
  const map = chat.state.map;
  const mr = chat.state.mapRenderer;
  if (!map || !mr || typeof c.x_frac !== 'number' || typeof c.y_frac !== 'number') return;
  const x = (c.x_frac / 10000) * (map.width_cells * map.cell_px);
  const y = (c.y_frac / 10000) * (map.height_cells * map.cell_px);
  mr.addPing(x, y, c.color);
}

function _handleDamage(chat, event) {
  // Skip own echo - we already recorded locally at apply time.
  const myUserId = chat.clientManager?.userId;
  if (event.sender && event.sender === myUserId) return;
  const c = event.content ?? {};
  chat.state.recordDamage?.({
    ts: c.ts,
    actor: c.actor ?? event.sender ?? null,
    target_id: c.target_id,
    target_name: c.target_name,
    delta: c.delta,
    kind: c.kind,
    source: c.source,
  });
}

/**
 * The msgtypes the chat pipeline accepts on `m.room.message` events.
 * Exported so the historical backfill path in `src/ui/log-panel.js`
 * uses the same allowlist; if only `m.text` survived the historical
 * filter, scene-roots (`m.notice`) would drop on reload.
 */
export const CHAT_MSGTYPES = new Set(['m.text', 'm.emote', 'm.notice']);

async function _handleRoomMessage(chat, event) {
  if (!event.content) return;
  const { msgtype, body } = event.content;
  if (!CHAT_MSGTYPES.has(msgtype)) return;

  const sender = event.sender;
  const historical = event._historical === true;
  const myUserId = chat.clientManager?.userId;

  // Don't double-log own LIVE messages (we already showed the local
  // echo at send time). Own HISTORICAL messages must still flow
  // through - after a page reload the local echo is gone and the
  // timeline replay is our only path to surface the GM's prior-session
  // scenes / chat in activityLog. The IconRail Scenes drawer stayed
  // empty because GMs are the typical scene authors and own historical
  // events were being filtered out here.
  if (sender !== myUserId || historical) {
    // m.notice (OOC) is always the player - ignore any persona field that
    // a non-conforming client might have attached.
    const speakAsTokenId = msgtype === 'm.notice'
      ? null
      : (event.content?.[EVENT_TYPES.SPEAK_AS_TOKEN] ?? null);
    const tone = msgtype === 'm.text' ? (event.content?.[EVENT_TYPES.TONE] ?? null) : null;
    const whisperTo = event.content?.whisper_to ?? null;
    const relates_to = event.content?.['m.relates_to'];
    const threadOf =
      relates_to?.rel_type === 'm.thread' && relates_to.event_id
        ? relates_to.event_id
        : null;
    // Markdown-formatted text from senders that support it. Receiver
    // re-runs renderMarkdown locally so DOMPurify always sees the
    // content (never trust foreign HTML).
    const format = event.content?.format ?? null;
    const formatted_body = event.content?.formatted_body ?? null;
    // Scene-root marker: foreign clients render the post normally;
    // we use the flag to apply chapter-break chrome in the log.
    const isSceneRoot = event.content?.['com.vtt.scene_root'] === true;
    const sceneTitle = event.content?.['com.vtt.scene_title'] ?? null;
    window.dispatchEvent(new CustomEvent(VTT_EVENTS.CHAT_MESSAGE, {
      detail: {
        sender, body, msgtype, tone,
        speakAsTokenId, historical, whisperTo,
        eventId: event.event_id ?? null, threadOf,
        format, formatted_body, isSceneRoot, sceneTitle,
      },
    }));
  }

  if (historical || msgtype !== 'm.text') return;

  const rollCommand = parseDiceRollCommand(body);
  if (rollCommand) {
    await executeDiceRollFromChat(chat, rollCommand, sender);
  }
}
