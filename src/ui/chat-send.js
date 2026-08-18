/**
 * chat-send.js - outbound chat message send + local echo.
 * ChatIntegrator drops events sent by the local user on sync-echo,
 * so the local log entry has to happen here.
 *
 * Three speaking modes:
 *   - 'say'      → m.text; supports persona + tone (bracket prefix + com.vtt.tone)
 *   - 'describe' → m.emote; supports persona; tone is ignored
 *   - 'ooc'      → m.notice; persona and tone are dropped (OOC is always the player)
 *
 * Persona handling: when speak-as-token is set, the persona name is
 * prefixed into the outgoing body (`Sora: …` for Say, `Sora …` for
 * Describe) so non-VTT Matrix clients (Element, etc.) see the
 * in-character speaker. The `com.vtt.speak_as_token` custom field is
 * still attached for VTT clients that want token identity for bubble
 * placement and dedup. See `chat-log-format.js` for the dedup helpers.
 */

import { esc } from '../utils/domHelpers.js';
import { EVENT_TYPES } from '../utils/constants.js';
import { VTTError, ErrorType, showErrorNotification } from '../utils/errorHandling.js';
import {
  speakAsSignal, replyContextSignal, chatModeSignal, chatToneSignal,
  activeSceneSignal,
} from '../state/ui-signals.js';
import { formatToneBody } from './chat-tones.js';
import { prefixBodyWithPersona, formatSayLogBody, formatEmoteLogBody } from './chat-log-format.js';
import { renderMarkdown } from '../utils/renderMarkdown.js';
import { parseSlash } from './slash-commands.js';

// Markdown is a common-enough source format that we want it on the
// wire when present, but a vast majority of "what's your AC?" sends are
// plain text. Detect any markdown-significant character before paying
// the formatted_body cost (extra bytes + a renderMarkdown call).
const MARKDOWN_HINT = /[*_`#>[\]]|\n/;
export function hasMarkdown(body) {
  return typeof body === 'string' && MARKDOWN_HINT.test(body);
}

/** @returns {'say'|'describe'|'ooc'} */
function _resolveMode() {
  const raw = chatModeSignal.value;
  if (raw === 'describe' || raw === 'ooc') return raw;
  return 'say';
}

export async function sendChatMessage(ui, rawValue) {
  const body = (rawValue ?? '').trim();
  if (!body) return;

  const input = document.getElementById('chat-input');
  if (input) input.value = '';

  // Slash-command grammar: /w, /as, /asd, /roll. Anything else falls
  // through to `kind: 'plain'` and behaves identically to the pre-
  // slash code path. The /as and /asd commands set a one-shot persona
  // name override that bypasses the speakAsSignal token lookup so an
  // ad-hoc NPC name ("/as Bartender …") doesn't change the GM's
  // current persistent persona selection.
  const slash = parseSlash(body);

  if (slash.kind === 'roll') {
    ui.rollMacro?.(slash.formula);
    return;
  }

  const whisperTo = slash.kind === 'whisper' ? slash.toUser : null;
  const personaOverride = (slash.kind === 'as' || slash.kind === 'asd')
    ? slash.personaName
    : null;
  const messageBody = (slash.kind === 'plain') ? body : slash.body;
  const slashMode = slash.kind === 'as' ? 'say'
    : slash.kind === 'asd' ? 'describe'
    : null;

  const mode = slashMode || _resolveMode();
  const tone = mode === 'say' ? chatToneSignal.value : null;
  // /as and /asd bypass the persistent persona selection - they're a
  // one-shot ad-hoc speaker, so no SPEAK_AS_TOKEN custom field.
  const speakAsTokenId = (mode !== 'ooc' && !personaOverride)
    ? (speakAsSignal.value || null)
    : null;
  const replyCtx = replyContextSignal.value;

  const msgtype = mode === 'describe' ? 'm.emote'
    : mode === 'ooc'       ? 'm.notice'
    :                        'm.text';

  // Resolve persona name once so both the wire body and the local log
  // line can reference it. Whispers stay plain (no persona prefix) so
  // the whisper helper line reads cleanly. /as and /asd provide an
  // explicit personaOverride that beats the token lookup.
  const personaToken = speakAsTokenId ? ui.state.tokens.get(speakAsTokenId) : null;
  const personaName = personaOverride ?? personaToken?.name ?? null;
  const toneBody = mode === 'say' ? formatToneBody(tone, messageBody) : messageBody;
  const finalBody = whisperTo
    ? toneBody
    : prefixBodyWithPersona(toneBody, personaName, mode);

  const content = { msgtype, body: finalBody };
  if (hasMarkdown(finalBody)) {
    content.format = 'org.matrix.custom.html';
    content.formatted_body = renderMarkdown(finalBody);
  }
  if (speakAsTokenId) content[EVENT_TYPES.SPEAK_AS_TOKEN] = speakAsTokenId;
  if (whisperTo) content.whisper_to = whisperTo;

  // Thread routing precedence:
  //   1. Explicit reply context (user clicked the ↪ on a specific message).
  //   2. Active scene (user is in scene mode).
  //   3. None - post lands in the main room timeline.
  // Whispers ALWAYS escape any thread: a public m.thread relation
  // would leak the "private" body to anyone reading the timeline.
  const scene = activeSceneSignal.value;
  if (replyCtx) {
    content['m.relates_to'] = {
      rel_type: 'm.thread',
      event_id: replyCtx.rootEventId,
      is_falling_back: true,
    };
  } else if (scene && !whisperTo) {
    content['m.relates_to'] = {
      rel_type: 'm.thread',
      event_id: scene.eventId,
      is_falling_back: true,
    };
  }

  if (mode === 'say' && tone && tone.name !== 'Neutral') {
    content[EVENT_TYPES.TONE] = tone;
  }

  let sendResult;
  try {
    sendResult = await ui.state.sendRoomEvent(EVENT_TYPES.ROOM_MESSAGE, content);
  } catch (err) {
    showErrorNotification(new VTTError(ErrorType.NETWORK, `Chat send failed: ${err.message}`, err));
    return;
  }

  if (replyCtx) replyContextSignal.value = null;

  // Tag the local-echo entry with the returned event_id so the sync-echo
  // path (and historical replay) dedupe against it via log()'s
  // _seenLogEventIds set.
  const eventId = sendResult?.event_id ?? null;
  const myUserId = ui.widgetManager?.userId;
  const tokenId = speakAsTokenId || ui._findTokenForSender(myUserId);
  const token = tokenId ? ui.state.tokens.get(tokenId) : null;
  // /as and /asd display under the override name, NOT the user's
  // matrix id - that's the whole point of the one-shot persona.
  const displayName =
    personaOverride ?? token?.name ?? myUserId?.split(':')[0]?.replace('@', '') ?? '?';

  const fmt = content.formatted_body
    ? { format: content.format, formatted_body: content.formatted_body }
    : null;

  if (whisperTo) {
    const toDisplay = whisperTo.split(':')[0].replace('@', '');
    ui._log('🔒', `<b>${esc(displayName)}</b> whispers to <b>${esc(toDisplay)}</b>: ${esc(finalBody)}`, { eventId, sender: myUserId });
  } else if (mode === 'describe') {
    ui._log('💭', formatEmoteLogBody(displayName, finalBody, personaName, fmt), { eventId, sender: myUserId, msgtype: 'm.emote' });
    if (tokenId && ui.mapRenderer?.showSpeechBubble) ui.mapRenderer.showSpeechBubble(tokenId, finalBody);
  } else if (mode === 'ooc') {
    const rendered = fmt ? renderMarkdown(finalBody) : esc(finalBody);
    ui._log('📢', `<span class="log-entry--ooc">((OOC)) <b>${esc(displayName)}</b>: ${rendered}</span>`, { eventId, sender: myUserId, msgtype: 'm.notice' });
  } else {
    ui._log('💬', formatSayLogBody(displayName, finalBody, personaName, fmt), { eventId, sender: myUserId });
    if (tokenId && ui.mapRenderer?.showSpeechBubble) ui.mapRenderer.showSpeechBubble(tokenId, finalBody);
  }
}
