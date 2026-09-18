/**
 * A formula nothing reads is a rulebook table that never reaches a player.
 *
 * `formulas` has exactly two consumers: a `stat.formula` reference inside
 * the same ruleset's sheets, and a literal `computeDerived(rs, 'name')`
 * call in shipped source. A test that calls one is not a reader; the
 * sheet has to show it.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
const RULESETS = join(SRC, 'content/rulesets');

function sourceFiles(dir = SRC, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__') continue;
      sourceFiles(full, out);
    } else if (/\.jsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function namesCalledInSource() {
  const names = new Set();
  for (const file of sourceFiles()) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/computeDerived\([^,]+,\s*'([a-z_0-9]+)'/g)) {
      names.add(m[1]);
    }
  }
  return names;
}

function statFormulaNames(ruleset) {
  const names = new Set();
  for (const m of JSON.stringify(ruleset).matchAll(/"formula":"([a-z_0-9]+)"/g)) {
    names.add(m[1]);
  }
  return names;
}

const calledInSource = namesCalledInSource();
const files = readdirSync(RULESETS).filter((f) => f.endsWith('.json'));

describe('every ruleset formula has a reader', () => {
  for (const file of files) {
    const ruleset = JSON.parse(readFileSync(join(RULESETS, file), 'utf8'));
    const declared = Object.keys(ruleset.formulas ?? {});
    const onSheet = statFormulaNames(ruleset);

    for (const name of declared) {
      it(`${file}: ${name} is shown on a sheet or called by name`, () => {
        const read = onSheet.has(name) || calledInSource.has(name);
        expect(read, `${name} is declared and nothing reads it; wire it or delete it`).toBe(true);
      });
    }
  }
});

describe('every sheet formula reference is declared', () => {
  for (const file of files) {
    const ruleset = JSON.parse(readFileSync(join(RULESETS, file), 'utf8'));
    const declared = new Set(Object.keys(ruleset.formulas ?? {}));

    for (const name of statFormulaNames(ruleset)) {
      it(`${file}: the sheet asks for ${name} and the ruleset declares it`, () => {
        expect(declared.has(name), `the sheet renders "-" for ${name}`).toBe(true);
      });
    }
  }
});
