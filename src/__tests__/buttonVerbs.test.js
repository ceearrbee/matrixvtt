/**
 * Button-verb vocabulary scan. The canonical set is Add / Edit / Delete
 * / Clear / Save (plus Cancel / Close). Wizard launchers ("New Map",
 * "New Campaign", "Create Character") are explicit exemptions.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

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

const BANNED_VERBS = ['Update', 'Remove', 'New', 'Create', 'Modify'];

// Labels allowed to keep a banned verb because they semantically launch
// a multi-step wizard rather than create a single entity.
const EXEMPTIONS = new Set([
  'New Campaign',
  'New Map',
  'New Table',
  'New Rollable',
  'Create Character',
  // Matrix-protocol vocabulary: rooms are "created", not "added".
  'Create Room',
]);

// Match a button-text-shaped literal: ">Verb Noun<" inside JSX/innerHTML,
// or "Verb Noun" passed as the first arg to a button-flavoured helper.
// We only flag when the noun is a Capitalized word so we don't sweep
// prose like "Update the GM settings".
const PATTERN = new RegExp(
  String.raw`[>'"\s+](${BANNED_VERBS.join('|')})\s+([A-Z][a-zA-Z]+)[<'"\s]`,
  'g',
);

describe('button verbs are canonical', () => {
  it('no banned verbs on button-shaped labels (Update / Remove / New / Create / Modify)', () => {
    const offences = [];
    for (const file of walk(srcRoot)) {
      const src = readFileSync(file, 'utf8');
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        // Skip obvious non-UI mentions: comments, regex patterns, this file.
        if (file.endsWith('buttonVerbs.test.js')) return;
        if (/^\s*\*|^\s*\/\//.test(line)) return;
        for (const m of line.matchAll(PATTERN)) {
          const label = `${m[1]} ${m[2]}`;
          if (EXEMPTIONS.has(label)) continue;
          // Heuristic: require the surrounding context to look like a
          // button. Class hooks `dbt`, `btn-`, an aria-label="...",
          // a `<button` on the same or prior line, or `_toast(`.
          const recent = lines.slice(Math.max(0, i - 2), i + 1).join('\n');
          if (!/dbt|btn-|<button|button class|data-modal-close|aria-label="[^"]*\b(button|click)/i.test(recent)) continue;
          offences.push(`${file.replace(srcRoot + '/', '')}:${i + 1} "${label}"`);
        }
      });
    }
    expect(offences, `non-canonical button verbs:\n${offences.join('\n')}`).toEqual([]);
  });
});
