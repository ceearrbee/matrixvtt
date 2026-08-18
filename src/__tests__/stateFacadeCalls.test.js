/**
 * Every <ui|mr|app>.state.<method>() call must resolve to a method on
 * the StateManager facade. A missing delegate is invisible until the
 * line runs: isTokenVisibleToPlayer existed in reader.js but not on
 * the facade, so the player-only initiative filter threw on first
 * render and bounced players back to the room list, while the map
 * layer's typeof-guard silently skipped visibility filtering.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { StateManager } from '../state/StateManager.js';

const SRC = path.join(process.cwd(), 'src');

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

describe('state facade completeness', () => {
  it('every *.state.<method>() call site has a StateManager method', () => {
    const called = new Map();
    for (const file of walk(SRC)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\b(?:ui|mr|app)\.state\.([A-Za-z_]\w*)\(/g)) {
        if (!called.has(m[1])) called.set(m[1], path.relative(process.cwd(), file));
      }
    }
    const proto = StateManager.prototype;
    const missing = [...called.entries()]
      .filter(([name]) => {
        const desc = Object.getOwnPropertyDescriptor(proto, name);
        return !(desc && (typeof desc.value === 'function' || typeof desc.get === 'function'));
      })
      .map(([name, file]) => `${name} (called in ${file})`);
    expect(missing).toEqual([]);
  });
});
