/**
 * chat-log-format.js - shared body formatters for the chat send/receive
 * pipeline.
 *
 * Wire format (since the persona-prefix change):
 *   - Say with a persona:      body = `${personaName}: ${toneAndBody}`
 *   - Describe with a persona: body = `${personaName} ${verbPhrase}`
 *   - Say without a persona:   body = toneAndBody (unchanged)
 *   - Describe without a persona / OOC: body unchanged
 *
 * `prefixBodyWithPersona` is the canonical place that decides whether to
 * add the prefix, and `bodyAlreadyPrefixed` is the matching guard local
 * echo and inbound log paths use to avoid double-prefixing.
 */

import { esc } from '../utils/domHelpers.js';
import { renderMarkdown } from '../utils/renderMarkdown.js';

const LONG_BODY_CHARS = 600;
const LONG_BODY_NEWLINES = 12;

/**
 * True when the body is long enough to deserve the "Show more" collapse
 * affordance in the log. Used by LogPanel to decorate the row.
 *
 * @param {string} body
 */
export function isLongBody(body) {
  if (typeof body !== 'string') return false;
  if (body.length > LONG_BODY_CHARS) return true;
  let nl = 0;
  for (let i = 0; i < body.length; i++) if (body.charCodeAt(i) === 10) nl++;
  return nl > LONG_BODY_NEWLINES;
}

/**
 * Render a chat body for the log. If the sender supplied `formatted_body`
 * (Element markdown send, our own markdown send, etc.) we run the SOURCE
 * (`body`, which is markdown / plain text) through DOMPurified
 * renderMarkdown locally - never trust foreign HTML. Otherwise we
 * escape the plain body.
 *
 * @param {string} body
 * @param {{ format?: string|null, formatted_body?: string|null }} opts
 * @returns {string} safe HTML
 */
export function renderChatBody(body, { format, formatted_body } = {}) {
  if (format === 'org.matrix.custom.html' && typeof formatted_body === 'string' && formatted_body) {
    // Re-render from source markdown when present; only fall back to the
    // foreign HTML if the source isn't markdown-y. renderMarkdown +
    // DOMPurify is cheap and guarantees the same sanitization rules
    // we use everywhere else.
    return renderMarkdown(body || '');
  }
  return esc(body || '');
}

/**
 * Apply the persona prefix to an outgoing message body.
 *
 * @param {string} body          Tone-formatted body (Say) or verb phrase (Describe).
 * @param {string|null} personaName  Display name of the speaking token, or null.
 * @param {'say'|'describe'|'ooc'} mode
 * @returns {string} the body that goes on the Matrix wire
 */
export function prefixBodyWithPersona(body, personaName, mode) {
  if (!personaName) return body;
  if (mode === 'ooc') return body; // OOC is always the player; no persona.
  if (mode === 'describe') return `${personaName} ${body}`;
  return `${personaName}: ${body}`;
}

/**
 * True when `body` already carries the persona prefix for `mode`. Used
 * by local echo + inbound rendering to skip the `<b>displayName</b>: `
 * prefix on the log line (otherwise the entry duplicates the persona).
 *
 * @param {string} body
 * @param {string|null} personaName
 * @param {'say'|'describe'|'ooc'} mode
 * @returns {boolean}
 */
export function bodyAlreadyPrefixed(body, personaName, mode) {
  if (!personaName || mode === 'ooc') return false;
  if (mode === 'describe') return body.startsWith(`${personaName} `);
  return body.startsWith(`${personaName}: `);
}

/**
 * Build the inner HTML for a Say-mode log entry, escaping every dynamic
 * piece. When the body is already prefixed, the displayName prefix is
 * skipped so the entry doesn't read `Sora: Sora: Hi`.
 *
 * @param {string} displayName
 * @param {string} body
 * @param {string|null} personaName
 * @returns {string} safe HTML
 */
export function formatSayLogBody(displayName, body, personaName, fmt = null) {
  const rendered = renderChatBody(body, fmt || {});
  if (bodyAlreadyPrefixed(body, personaName, 'say')) {
    return rendered;
  }
  return `<b>${esc(displayName)}</b>: ${rendered}`;
}

/**
 * Describe-mode log entry. m.emote convention is `* <subject> <verb>`.
 * If the body already starts with the persona name (because we sent it
 * with the persona embedded as the subject), just italicise the body
 * with a leading `*`. Otherwise prepend the displayName.
 *
 * @param {string} displayName
 * @param {string} body
 * @param {string|null} personaName
 * @returns {string} safe HTML
 */
/**
 * Build the chapter-break HTML for a scene root. Used both by the
 * inbound dispatch (a remote user started a scene) and the local
 * echo path (the user themselves just started one) so the chrome
 * can't drift.
 *
 * @param {string} title
 * @param {string} openingBody
 * @param {{ format?: string|null, formatted_body?: string|null } | null} fmt
 * @returns {string} safe HTML
 */
export function formatSceneRootBody(title, openingBody, fmt) {
  const safeTitle = esc(title || 'Scene');
  const rendered  = renderChatBody(openingBody, fmt || {});
  return `<div class="log-entry--scene-root">`
       +   `<div class="log-entry__scene-title">🎬 ${safeTitle}</div>`
       +   `<div class="log-entry__scene-opening">${rendered}</div>`
       + `</div>`;
}

export function formatEmoteLogBody(displayName, body, personaName, fmt = null) {
  const rendered = renderChatBody(body, fmt || {});
  if (bodyAlreadyPrefixed(body, personaName, 'describe')) {
    return `<i>* ${rendered}</i>`;
  }
  return `<i>* <b>${esc(displayName)}</b> ${rendered}</i>`;
}
