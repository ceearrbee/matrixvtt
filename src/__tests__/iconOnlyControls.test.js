/**
 * A control whose whole visible content is a glyph has to say what it
 * does twice: `aria-label` for a screen reader, `title` for a pointer
 * user hovering it. Seven shipped with only the first, including every
 * modal and floating-window close button, so a sighted mouse user had
 * no way to learn what the bare "×" closed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const uiRoot = resolve(here, '../ui');

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (/\.(jsx?|mjs)$/.test(name)) yield full;
  }
}

// A button whose children are one bare glyph: h('button', {...}, '×').
// Icon-component children are matched separately because they span
// lines; this catches the single-character case the audit found.
const GLYPH_BUTTON = /h\(\s*'button'\s*,\s*(\{[\s\S]*?\})\s*,\s*'([^a-zA-Z0-9\s]{1,2})'\s*\)/g;

describe('glyph-only controls name themselves twice', () => {
  it('every bare-glyph button carries both aria-label and title', () => {
    const offenders = [];
    for (const file of walk(uiRoot)) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(GLYPH_BUTTON)) {
        const props = m[1];
        const missing = [];
        if (!/'aria-label'\s*:/.test(props)) missing.push('aria-label');
        if (!/\btitle\s*:/.test(props)) missing.push('title');
        if (missing.length === 0) continue;
        const line = src.slice(0, m.index).split('\n').length;
        offenders.push(`${relative(uiRoot, file)}:${line} "${m[2]}" missing ${missing.join(' + ')}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
