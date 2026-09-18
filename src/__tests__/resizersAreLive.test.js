/**
 * A resizer that writes a variable nothing reads is dead, and nothing
 * noticed for as long as it shipped.
 *
 * The old module wrote `--init-panel-width` from a handle that was
 * `display: none`, and no rule consumed the variable. Both halves were
 * invisible to the suite because no test asked whether the thing was
 * reachable at all. This asks.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
const css = readFileSync(join(SRC, 'styles.css'), 'utf8');

/**
 * Drop every at-rule block, so "hidden on coarse pointers" is not read
 * as "hidden". Only an unconditional hide makes a handle unreachable.
 */
function withoutAtRules(source) {
  let out = '';
  for (let i = 0; i < source.length; i++) {
    if (source[i] !== '@') { out += source[i]; continue; }
    const open = source.indexOf('{', i);
    if (open === -1) break;
    let depth = 0;
    let j = open;
    for (; j < source.length; j++) {
      if (source[j] === '{') depth++;
      else if (source[j] === '}' && --depth === 0) break;
    }
    i = j;
  }
  return out;
}

const unconditionalCss = withoutAtRules(css);

function sourceFiles(dir = SRC, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== '__tests__') sourceFiles(full, out);
    } else if (/\.jsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** Custom properties a component writes as an inline style. */
function writtenVars() {
  const found = new Set();
  for (const file of sourceFiles()) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/--([a-z0-9-]*(?:panel|strip|rail)[a-z0-9-]*)\s*:/g)) {
      found.add(`--${m[1]}`);
    }
  }
  return [...found];
}

describe('every panel dimension a component writes is read by a rule', () => {
  for (const name of writtenVars()) {
    it(`${name} is consumed somewhere in the stylesheet`, () => {
      // A declaration is not a use: var(--x) is.
      expect(css, `${name} is written but no rule reads it`).toContain(`var(${name}`);
    });
  }
});

describe('every resize handle can be seen and reached', () => {
  const handles = sourceFiles()
    .flatMap((file) => {
      const src = readFileSync(file, 'utf8');
      return [...src.matchAll(/class:\s*'([a-z-]*__resize)'/g)].map((m) => m[1]);
    });

  it('finds at least one handle, or this gate is watching nothing', () => {
    expect(handles.length).toBeGreaterThan(0);
  });

  for (const cls of new Set(handles)) {
    it(`.${cls} is never display:none at every width`, () => {
      // A handle may be hidden inside a media query, which is how the
      // coarse-pointer case is handled; it must not be hidden outright.
      const bare = new RegExp(`\\.${cls}\\s*\\{[^}]*display:\\s*none`);
      expect(bare.test(unconditionalCss), `.${cls} is hidden unconditionally`).toBe(false);
    });

    it(`.${cls} is keyboard focusable`, () => {
      const owner = sourceFiles().find((f) => readFileSync(f, 'utf8').includes(`'${cls}'`));
      expect(readFileSync(owner, 'utf8')).toMatch(/tabindex:\s*'0'/);
    });
  }
});
