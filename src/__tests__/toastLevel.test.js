/**
 * Static scan: every `_toast(..., '<level>')` literal in src/ must use
 * one of the four canonical levels (info | success | warn | error).
 * Catches drift like 'warning' vs 'warn'.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { TOAST_LEVEL } from '../utils/constants.js';

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

const CANONICAL = new Set(Object.values(TOAST_LEVEL));
const TOAST_CALL = /_toast\??\.?\([^)]*?,\s*['"]([a-zA-Z]+)['"]\s*\)/g;

describe('toast-level enum', () => {
  it('TOAST_LEVEL exposes info, success, warn, error', () => {
    expect(CANONICAL).toEqual(new Set(['info', 'success', 'warn', 'error']));
  });

  it('every _toast call site uses a canonical level', () => {
    const bad = [];
    for (const file of walk(srcRoot)) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(TOAST_CALL)) {
        if (!CANONICAL.has(m[1])) {
          bad.push(`${file.replace(srcRoot + '/', '')}: '${m[1]}'`);
        }
      }
    }
    expect(bad, `non-canonical toast levels:\n${bad.join('\n')}`).toEqual([]);
  });
});
