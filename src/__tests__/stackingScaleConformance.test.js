/**
 * Twelve distinct z-index values across fifteen sites, and a
 * `10999 !important` sitting beside an `11000`, is what a stack with no
 * order looks like. The `--z-*` scale in `styles.css` is that order.
 *
 * A raw value below 10 is local stacking inside one positioned
 * container and stays raw. Anything that competes with another layer
 * comes from the scale, and a `var(--z-thing, 9999)` fallback is not a
 * scale entry - it is an undefined token with a magic number behind it.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
const LOCAL_STACKING_CEILING = 10;

function cssFiles(dir = SRC, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      cssFiles(full, out);
    } else if (name.endsWith('.css')) {
      out.push(full);
    }
  }
  return out;
}

const files = cssFiles();
const scale = new Set();
for (const m of readFileSync(join(SRC, 'styles.css'), 'utf8').matchAll(/^\s*(--z-[a-z-]+):/gm)) {
  scale.add(m[1]);
}

describe('the stacking scale is the only order', () => {
  it('styles.css declares the scale', () => {
    expect(scale.size).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = file.slice(SRC.length + 1);
    const text = readFileSync(file, 'utf8');

    const raw = [];
    for (const m of text.matchAll(/z-index:\s*([^;]+);/g)) {
      const value = m[1].trim();
      if (value.includes('--z-')) continue;
      if (Number(value) < LOCAL_STACKING_CEILING) continue;
      raw.push(value);
    }

    it(`${rel} takes every competing layer from the scale`, () => {
      expect(raw, `raw z-index ${raw.join(', ')}; name the layer in the --z-* scale`).toEqual([]);
    });

    const referenced = [...text.matchAll(/var\(([^)]+)\)/g)]
      .map(([full, inner]) => {
        const comma = inner.indexOf(',');
        const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
        return { full, name, fallback: comma !== -1 };
      })
      .filter(({ name }) => name.startsWith('--z-'));

    it(`${rel} references only tokens the scale declares`, () => {
      const unknown = referenced.filter((r) => !scale.has(r.name)).map((r) => r.name);
      expect(unknown, `undeclared ${unknown.join(', ')}`).toEqual([]);
    });

    it(`${rel} carries no fallback behind a scale token`, () => {
      const withFallback = referenced.filter((r) => r.fallback).map((r) => r.full);
      expect(withFallback, `a fallback hides an undefined token: ${withFallback.join(', ')}`)
        .toEqual([]);
    });
  }
});
