/**
 * Every `ui.something()` call site must name a method the controller
 * actually has.
 *
 * `_publicSurface.test.js` checks the constructed ui against the
 * allow-list, which keeps the list honest about the object. It says
 * nothing about the call sites, and almost every one of them is
 * optional-chained: `ui?.duplicateToken?.(id)` on a name that does not
 * exist is not a crash, it is a button that quietly does nothing. That
 * is the shape the dev-only-global bug took, and it took a production
 * build to notice.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PUBLIC_SURFACE, INTERNAL_SURFACE, LIFECYCLE_ONLY } from '../ui/_public-surface.js';

const SRC = resolve(import.meta.dirname, '..');

/** `ui.foo = `, `ui._foo = ` - a method attached at runtime exists. */
const ASSIGN = /(?<![\w$])_?ui\.([A-Za-z_$][\w$]*)\s*=[^=]/g;

/**
 * `ui.foo(`, `ui?.foo?.(`, `this.ui.foo(`, and `mr._ui?.foo?.(` - the
 * last of those is how every map module reaches the controller. Two
 * earlier passes at this regex were useless against the very call sites
 * that prompted it: one ignored `_ui`, and both wrote the optional call
 * as `?(` when the syntax is `?.(`.
 */
const CALL = /(?<![\w$])_?ui\??\.([A-Za-z_$][\w$]*)(?:\?\.)?\(/g;

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue;
      out.push(...sourceFiles(full));
    } else if (/\.jsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function scan(pattern) {
  const found = new Map();
  for (const file of sourceFiles(SRC)) {
    for (const match of readFileSync(file, 'utf8').matchAll(pattern)) {
      const name = match[1];
      if (!found.has(name)) found.set(name, new Set());
      found.get(name).add(file.slice(SRC.length + 1));
    }
  }
  return found;
}

const callSites = () => scan(CALL);

/**
 * The allow-list plus anything assigned onto `ui` anywhere in the tree.
 * The lifecycle disposers are the reason: they are attached by the full
 * `createUI` and called in the same file, and `_publicSurface.test.js`
 * builds a `createMinimalUI` that never has them, so listing them there
 * would fail its own no-stale-entries check. A typo still has no
 * assignment to match, which is what this gate is for.
 */
function knownNames() {
  return new Set([
    ...Object.values(PUBLIC_SURFACE).flat(),
    ...INTERNAL_SURFACE,
    ...LIFECYCLE_ONLY,
    ...scan(ASSIGN).keys(),
  ]);
}

describe('ui call sites', () => {
  it('finds enough of them to be worth gating', () => {
    expect(callSites().size).toBeGreaterThan(80);
  });

  // The regex has to reach the map modules, which hold the controller
  // as `_ui`, or it gates only half the codebase.
  it('sees the map modules, which reach the controller as _ui', () => {
    const sites = callSites();
    expect(sites.has('removeFromInitiative')).toBe(true);
    expect([...sites.get('removeFromInitiative')].some((f) => f.startsWith('map/'))).toBe(true);
  });

  it('every one names a method the controller has', () => {
    const known = knownNames();
    const unknown = [...callSites()]
      .filter(([name]) => !known.has(name))
      .map(([name, files]) => `${name} (${[...files].join(', ')})`);
    expect(unknown).toEqual([]);
  });
});
