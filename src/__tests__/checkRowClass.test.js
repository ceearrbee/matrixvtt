/**
 * The clickable-flex-row style was inlined thirteen times before
 * `.form-check-row` existed, and kept being inlined after. The class is
 * the only place that rule belongs.
 *
 * The signature is the three properties together: a flex row, centred,
 * that claims to be clickable. A flex row without `cursor: pointer` is
 * layout and stays inline; this is about the affordance.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

function sourceFiles(dir = SRC, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      sourceFiles(full, out);
    } else if (/\.jsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function checkRowsInlined(rel, text) {
  const found = [];
  text.split('\n').forEach((line, index) => {
    const compact = line.replace(/\s/g, '');
    if (
      compact.includes('display:flex') &&
      compact.includes('align-items:center') &&
      compact.includes('cursor:pointer')
    ) {
      found.push(`${rel}:${index + 1}`);
    }
  });
  return found;
}

describe('the clickable row has one home', () => {
  it('no inline style repeats what .form-check-row declares', () => {
    const violations = sourceFiles().flatMap(
      (file) => checkRowsInlined(file.slice(SRC.length + 1), readFileSync(file, 'utf8')),
    );
    expect(violations, `use class "form-check-row": ${violations.join(', ')}`).toEqual([]);
  });

  it('styles.css declares the class exactly once', () => {
    const styles = readFileSync(join(SRC, 'styles.css'), 'utf8');
    expect(styles.match(/^\.form-check-row\s*\{/gm)).toHaveLength(1);
  });
});
