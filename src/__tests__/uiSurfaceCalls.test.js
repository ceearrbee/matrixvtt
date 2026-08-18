/**
 * Optional-chained ui method calls (`ui.<name>?.(`) are silent no-ops
 * when the method is never wired, which is how broken seams hide
 * (setStressBox was called for months with no assignment anywhere).
 * Every such call must resolve to a real assignment (`ui.<name> = `)
 * in some module, or be a property root the controller carries as
 * data rather than a wired method.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.join(process.cwd(), 'src');

// Data properties and namespaces on the ui object; not wired methods.
const PROPERTY_ROOTS = new Set([
  'state', 'widgetManager', 'chat', 'doc', 'win', 'location', 'history',
  'mapRenderer', 'appLog', 'container', 'MatrixClient', 'auth',
  'currentSession', 'resolvedHs', 'matrixVTTClient',
]);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      yield* walk(full);
    } else if (/\.(js|jsx)$/.test(entry.name)) {
      yield full;
    }
  }
}

describe('every optional-chained ui method call is wired somewhere', () => {
  it('finds an assignment for each ui.<name>?.( call', () => {
    const assigned = new Set();
    const calls = new Map();

    for (const file of walk(SRC)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\bui\.([A-Za-z_]\w*)\s*=[^=]/g)) {
        assigned.add(m[1]);
      }
      for (const m of text.matchAll(/\bui\??\.([A-Za-z_]\w*)\?\.\(/g)) {
        const name = m[1];
        if (PROPERTY_ROOTS.has(name) || name.startsWith('_')) continue;
        if (!calls.has(name)) calls.set(name, []);
        calls.get(name).push(path.relative(process.cwd(), file));
      }
    }

    const unwired = [...calls.entries()]
      .filter(([name]) => !assigned.has(name))
      .map(([name, files]) => `${name} (called in ${[...new Set(files)].join(', ')})`);
    expect(unwired).toEqual([]);
  });
});
