/**
 * The `--space-*` and `--border-radius-*` scales exist so spacing has
 * one vocabulary. They landed in Phase L and the tree kept writing raw
 * px beside them, which is how `border-radius: 2px` came to ignore the
 * Nondescript theme, whose whole job is to flatten every radius to 3px.
 *
 * The rule is narrow on purpose: if the scale already carries a value,
 * a spacing property must name the token rather than repeat the number.
 * An off-scale one-off (a 64px gutter cut to clear a button, a 22px
 * hanging indent) stays raw - inventing a token for each would make the
 * scale a list of every number in the tree.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

const SPACE_TOKENS = {
  2: '--space-2xs', 4: '--space-xs', 6: '--space-sm', 8: '--space-md',
  10: '--space-lg', 12: '--space-xl', 16: '--space-2xl', 20: '--space-3xl',
  24: '--space-4xl',
};
const RADIUS_TOKENS = {
  2: '--border-radius-sm', 3: '--border-radius-md', 4: '--border-radius-lg',
  999: '--radius-pill',
};

const SPACING_PROPERTY =
  '(?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|bottom|left|right))?';
const RADIUS_PROPERTY = 'border-radius';
const DECLARATION = new RegExp(`\\b(${SPACING_PROPERTY}|${RADIUS_PROPERTY})\\s*:\\s*([^;}\n"'\`]+)`, 'g');
const PIXELS = /(?<![\w-])(\d+)px/g;

function sourceFiles(dir = SRC, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      sourceFiles(full, out);
    } else if (/\.(css|jsx?)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function offScale(rel, text) {
  const found = [];
  text.split('\n').forEach((line, index) => {
    for (const [, property, value] of line.matchAll(DECLARATION)) {
      const tokens = property === RADIUS_PROPERTY ? RADIUS_TOKENS : SPACE_TOKENS;
      for (const [, pixels] of value.matchAll(PIXELS)) {
        const token = tokens[Number(pixels)];
        if (token) found.push(`${rel}:${index + 1} ${property}: ${pixels}px -> var(${token})`);
      }
    }
  });
  return found;
}

describe('spacing comes from the scale', () => {
  it('no spacing property repeats a number the scale already holds', () => {
    const violations = sourceFiles().flatMap(
      (file) => offScale(file.slice(SRC.length + 1), readFileSync(file, 'utf8')),
    );
    expect(violations, `\n${violations.join('\n')}`).toEqual([]);
  });
});
