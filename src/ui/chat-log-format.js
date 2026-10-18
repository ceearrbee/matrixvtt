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
import { renderMarkdown, hasMarkdown } from '../utils/renderMarkdown.js';
import { renderWikilinks } from '../utils/wikilinks.js';
import { normalizeEmDashes } from '../utils/format.js';


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
 * Render a chat body for the log. When markdown is present (either via formatted_body
 * or source syntax like **bold**, *italic*, [[wikilinks]], etc.), we run the source
 * body through DOMPurified renderMarkdown and renderWikilinks locally.
 *
 * @param {string} body
 * @param {{ format?: string|null, formatted_body?: string|null, resolveEntity?: any }} opts
 * @returns {string} safe HTML
 */
export function renderChatBody(body, opts = {}) {
  const { format, formatted_body, resolveEntity } = (typeof opts === 'object' && opts !== null) ? opts : {};
  const normalizedBody = typeof body === 'string' ? normalizeEmDashes(body) : (body || '');
  let rendered;
  if (format === 'org.matrix.custom.html' && typeof formatted_body === 'string' && formatted_body) {
    rendered = renderMarkdown(normalizedBody);
  } else if (typeof normalizedBody === 'string' && hasMarkdown(normalizedBody)) {
    rendered = renderMarkdown(normalizedBody);
  } else {
    rendered = esc(normalizedBody);
  }

  rendered = rendered.trim();

  // Strip wrapping single paragraph so inline prefixes stay on the same line
  if (rendered.startsWith('<p>') && rendered.endsWith('</p>') && rendered.indexOf('<p>', 3) === -1) {
    rendered = rendered.slice(3, -4);
  }

  const titleToId = resolveEntity?.titleToId || null;
  const tablesById = resolveEntity?.tables || resolveEntity?.tablesById || null;
  const refs = resolveEntity?.refs || resolveEntity || null;

  return renderWikilinks(rendered, titleToId, tablesById, refs, opts);
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
  if (!body || typeof body !== 'string' || mode === 'ooc') return false;
  if (/^[\p{Extended_Pictographic}\uFE0F\u200D]+/u.test(body)) {
    return true;
  }
  if (!personaName) return false;
  if (mode === 'describe') {
    if (body.startsWith(`${personaName} `)) return true;
  } else {
    if (body.startsWith(`${personaName}: `)) return true;
  }
  return false;
}

/**
 * Build the inner HTML for a Say-mode log entry, escaping every dynamic
 * piece. When the body is already prefixed, the displayName prefix is
 * skipped so the entry doesn't read `Sora: Sora: Hi`.
 *
 * @param {string} displayName
 * @param {string} body
 * @param {string|null|object} personaName
 * @returns {string} safe HTML
 */
export function formatSayLogBody(displayName, body, personaName = null, fmt = null, resolveEntity = null) {
  let pName = personaName;
  let opts = fmt;
  let resolver = resolveEntity;

  if (personaName && typeof personaName === 'object') {
    opts = personaName;
    pName = personaName.personaName ?? null;
    resolver = personaName.resolveEntity ?? resolveEntity;
  }
  const effectivePersona = pName || displayName;
  const mergedOpts = (opts && typeof opts === 'object') ? { ...opts, resolveEntity: resolver } : { resolveEntity: resolver };
  const rendered = renderChatBody(body, mergedOpts);
  if (bodyAlreadyPrefixed(body, effectivePersona, 'say')) {
    return rendered;
  }
  return `<b>${esc(displayName)}</b>: ${rendered}`;
}

function stripRedundantSceneTitle(openingBody, title) {
  if (!openingBody || typeof openingBody !== 'string') return '';
  if (!title || typeof title !== 'string') return openingBody;
  const rawBody = openingBody.trimStart();
  const firstNl = rawBody.indexOf('\n');
  const firstLine = (firstNl === -1 ? rawBody : rawBody.slice(0, firstNl)).trim();
  const lineWithoutIcon = firstLine.replace(/^🎬\s*/u, '');
  const normFirst = lineWithoutIcon.replace(/[\u2014\u2013-]/g, '-').trim();
  const normTitle = title.replace(/[\u2014\u2013-]/g, '-').trim();

  if (normFirst === normTitle) {
    if (firstNl === -1) return '';
    return rawBody.slice(firstNl + 1).trimStart();
  }
  return openingBody;
}

/**
 * Build the chapter-break HTML for a scene root. Used both by the
 * inbound dispatch (a remote user started a scene) and the local
 * echo path (the user themselves just started one) so the chrome
 * can't drift.
 *
 * @param {string} title
 * @param {string} openingBody
 * @param {{ format?: string|null, formatted_body?: string|null } | null} fmt
 * @param {any} resolveEntity
 * @returns {string} safe HTML
 */
export function formatSceneRootBody(title, openingBody, fmt = null, resolveEntity = null) {
  const normTitle = normalizeEmDashes(title || 'Scene');
  const safeTitle = esc(normTitle);
  const opts = (fmt && typeof fmt === 'object') ? { ...fmt, resolveEntity } : { resolveEntity };
  const strippedOpening = stripRedundantSceneTitle(normalizeEmDashes(openingBody), title);
  const rendered  = renderChatBody(strippedOpening, opts);
  return `<div class="log-entry--scene-root">`
       +   `<div class="log-entry__scene-title">🎬 ${safeTitle}</div>`
       +   `<div class="log-entry__scene-opening">${rendered}</div>`
       + `</div>`;
}

export function formatEmoteLogBody(displayName, body, personaName, fmt = null, resolveEntity = null) {
  const opts = (fmt && typeof fmt === 'object') ? { ...fmt, resolveEntity } : { resolveEntity };
  const rendered = renderChatBody(body, opts);
  if (bodyAlreadyPrefixed(body, personaName, 'describe')) {
    return `<i>* ${rendered}</i>`;
  }
  return `<i>* <b>${esc(displayName)}</b> ${rendered}</i>`;
}
