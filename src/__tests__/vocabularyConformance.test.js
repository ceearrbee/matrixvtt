/**
 * Static scan: one word per thing.
 *
 * The product had synonyms rather than a vocabulary. One value carried
 * three labels inside one create flow: "New session name" on the
 * discovery screen, "Campaign Name" in the setup wizard, and "Session
 * Name" in Settings sitting three lines under a heading that already
 * said "Campaign". This gate corners each word into one meaning.
 *
 *   Campaign - the game you are playing and everything in it. The only
 *              user-facing name for it.
 *   Room     - the Matrix room that stores it. Surfaced only where the
 *              user handles a Matrix address: room ID, invite link,
 *              join, leave.
 *   Session  - the browser's login. Never the campaign.
 *
 * Telling copy from identifiers is the hard part. The rule: a string
 * literal is user-facing copy unless every whitespace-separated token
 * in it is all-lowercase. Identifiers here are lowercase kebab
 * (`persona-chip__label`), dotted (`com.vtt.tone`) or colon-prefixed
 * (`vtt:ui-mode`); copy carries a capital. That keeps `.chronicle` and
 * `knock-requests__list` out of scope while catching the prose.
 *
 * Known blind spots, accepted: an all-lowercase single-word label is
 * invisible to the scan (no term retired here is one); the scan covers
 * `src/` only, as every other gate in this repo does; ruleset JSON is
 * third-party content and out of scope.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, '..');

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (/\.(jsx?|mjs)$/.test(name)) yield full;
  }
}

const IDENT_TOKEN = /^[a-z0-9][a-z0-9._:/@#-]*$/;
const LITERAL = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\\n]|\\.)*)`/g;

/** @returns {string|null} the copy, or null when the literal is an identifier. */
function userFacing(raw) {
  if (/^\.{1,2}\//.test(raw)) return null;              // import specifier
  const s = raw.replace(/\$\{[^}]*\}/g, ' ').trim();     // drop interpolations
  if (!/[A-Za-z]/.test(s)) return null;
  if (!/\s/.test(s) && s.includes('.')) return null;     // Session.logged_out
  if (s.split(/\s+/).every((t) => IDENT_TOKEN.test(t))) return null;
  return s;
}

const TERMS = [
  {
    canonical: 'Campaign',
    retired: /\bsessions?\b/i,
    // The login sense, which keeps the word. Each is individually
    // reviewable, which is what makes "session" safe to corner.
    allow: [
      'Session expired. Please log in again.',
      'Your session has expired. Please sign in again.',
      'Restoring session…',
      'Permanently delete all local data? This clears your sign-in, recent campaigns list, and all local settings. Campaign data stored on Matrix servers is NOT deleted.',
    ],
  },
  {
    canonical: 'Scene',
    // "The forum" and "the scene forum" named the Scenes surface twice
    // more. "Thread" survives: it is the Matrix concept, and it reads
    // as a verb in "a scene threads chat under a story beat".
    retired: /\bforums?\b/i,
    allow: [],
  },
  {
    canonical: 'Chat',
    // "chronicle" is a CSS class, never an on-screen label, yet the
    // help copy sent the user looking for it.
    retired: /\bchronicle\b/i,
    allow: [],
  },
];

/** Scan per line: gives file:line for free, and avoids a regex literal
 *  in chat-send.js mis-lexing as one enormous string. */
function offences(term) {
  const found = [];
  for (const file of walk(srcRoot)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
      const code = line.replace(/(^|[^:])\/\/.*$/, '$1');
      for (const m of code.matchAll(LITERAL)) {
        const copy = userFacing(m[1] ?? m[2] ?? m[3] ?? '');
        if (!copy || !term.retired.test(copy)) continue;
        if (term.allow.includes(copy)) continue;
        found.push(`${relative(srcRoot, file)}:${i + 1}  ${copy.slice(0, 80)}`);
      }
    });
  }
  return found;
}

describe('vocabulary conformance', () => {
  for (const term of TERMS) {
    it(`${term.canonical} has no retired synonym in user-facing copy`, () => {
      const found = offences(term);
      expect(found, `use "${term.canonical}":\n${found.join('\n')}`).toEqual([]);
    });
  }

  it('classifies class names and import specifiers as not-copy', () => {
    expect(userFacing('dbt dbt--sm persona-chip')).toBeNull();
    expect(userFacing('knock-requests__list')).toBeNull();
    expect(userFacing('chronicle')).toBeNull();
    expect(userFacing('./gm/session-ops.js')).toBeNull();
    expect(userFacing('Session.logged_out')).toBeNull();
    expect(userFacing('com.vtt.tone')).toBeNull();
  });

  it('classifies sentence copy as copy, interpolations and all', () => {
    expect(userFacing('Recent Sessions')).toBe('Recent Sessions');
    expect(userFacing('The forum')).toBe('The forum');
    expect(userFacing('Failed to start session: ${err.message}')).toMatch(/Failed to start session/);
  });
});
