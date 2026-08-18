/**
 * Every dbt--* / btn-* class referenced by a UI component must exist in
 * a stylesheet. Three phantom classes shipped unstyled: btn-danger (the
 * dirty-guard Discard button looked identical to Keep editing),
 * dbt--warning (the degraded sync chip rendered unstyled), and
 * dbt--ghost (9 call sites lost their intended low-emphasis look).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(entry.name) && !full.includes('__tests__')) out.push(full);
  }
  return out;
}

describe('button class conformance', () => {
  it('every referenced dbt--*/btn-* class is defined in a stylesheet', () => {
    const css = [
      fs.readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8'),
      fs.readFileSync(path.join(ROOT, 'src/themes/chat-shell.css'), 'utf8'),
    ].join('\n');

    const referenced = new Set();
    for (const file of walk(path.join(ROOT, 'src/ui'))) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/(?<![\w-])(dbt--[a-z][a-z-]*|btn-[a-z][a-z-]*)\b/g)) {
        referenced.add(m[1]);
      }
    }
    expect(referenced.size).toBeGreaterThan(0);

    const undefinedClasses = [...referenced].filter((cls) => !css.includes(`.${cls}`));
    expect(undefinedClasses).toEqual([]);
  });
});
