/**
 * slash-commands.js - chat-shell slash-command parser.
 *
 * Parses the rpglog-style grammar at the head of an outgoing chat body
 * and returns a discriminated union the send pipeline routes on:
 *
 *   /w  <user> <body>     → { kind: 'whisper', toUser, body }
 *   /as <name> <body>     → { kind: 'as',  personaName, body }
 *   /asd <name> <body>    → { kind: 'asd', personaName, body }
 *   /roll <formula>       → { kind: 'roll', formula }       (alias: /r)
 *   (anything else)       → { kind: 'plain', body }
 *
 * Pure function - no signals, no DOM. Designed to be the only place
 * that knows the slash grammar so adding a command means adding a
 * branch here, not threading new regex through send paths.
 *
 * Persona-name quoting: `/as "Old Knight" body` is supported so multi-
 * word ad-hoc NPC names work; for bare names the first whitespace-
 * separated token is the name.
 */

/**
 * @typedef {{ kind: 'plain', body: string }} PlainResult
 * @typedef {{ kind: 'whisper', toUser: string, body: string }} WhisperResult
 * @typedef {{ kind: 'as', personaName: string, body: string }} SayAsResult
 * @typedef {{ kind: 'asd', personaName: string, body: string }} DescribeAsResult
 * @typedef {{ kind: 'roll', formula: string }} RollResult
 * @typedef {PlainResult|WhisperResult|SayAsResult|DescribeAsResult|RollResult} SlashResult
 */

const WHISPER_RE = /^\/w\s+(\S+)\s+(.+)$/i;
const ROLL_RE = /^\/(?:roll|r)\s+(.+)$/i;

// Persona-prefix matchers - /asd has to come before /as in the
// supports "two-word names" the unquoted form can't.
const AS_QUOTED_RE  = /^\/as\s+"([^"]+)"\s+(.+)$/i;
const AS_BARE_RE    = /^\/as\s+(\S+)\s+(.+)$/i;
const ASD_QUOTED_RE = /^\/asd\s+"([^"]+)"\s+(.+)$/i;
const ASD_BARE_RE   = /^\/asd\s+(\S+)\s+(.+)$/i;

/** @param {string} body @returns {SlashResult} */
export function parseSlash(body) {
  if (typeof body !== 'string' || body.length === 0) {
    return { kind: 'plain', body: body ?? '' };
  }
  if (body[0] !== '/') {
    return { kind: 'plain', body };
  }

  let m;

  // /asd must precede /as so the longer prefix wins.
  if ((m = body.match(ASD_QUOTED_RE))) {
    return { kind: 'asd', personaName: m[1], body: m[2] };
  }
  if ((m = body.match(ASD_BARE_RE))) {
    return { kind: 'asd', personaName: m[1], body: m[2] };
  }
  if ((m = body.match(AS_QUOTED_RE))) {
    return { kind: 'as', personaName: m[1], body: m[2] };
  }
  if ((m = body.match(AS_BARE_RE))) {
    return { kind: 'as', personaName: m[1], body: m[2] };
  }
  if ((m = body.match(WHISPER_RE))) {
    return { kind: 'whisper', toUser: m[1], body: m[2] };
  }
  if ((m = body.match(ROLL_RE))) {
    return { kind: 'roll', formula: m[1] };
  }
  return { kind: 'plain', body };
}
