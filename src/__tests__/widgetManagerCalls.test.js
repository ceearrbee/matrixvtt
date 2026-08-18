/**
 * Every wm.<method>() call in the widget helpers must resolve to a
 * method on a real WidgetManager. The helpers only ever met
 * hand-written mocks in tests, so room-adapter kept calling
 * wm._recordCall() long after the method was deleted: every
 * power-level read threw, the error path returned 0, and the room
 * creator sat at "Waiting for GM".
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { WidgetManager } from '../widget/WidgetManager.js';

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

describe('widget manager call sites', () => {
  it('every wm.<method>() / widgetManager.<method>() call has a WidgetManager method', () => {
    const called = new Map();
    for (const file of walk(SRC)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\b(?:wm|widgetManager)\??\.([A-Za-z_$]\w*)\(/g)) {
        // A typeof guard in the same file marks the method as optional
        // by design (standalone-only API the widget transport can't
        // offer); the call site already degrades without it.
        if (new RegExp(`typeof\\s+(?:wm|widgetManager|\\w+\\.widgetManager)\\??\\.${m[1]}\\b`).test(text)) continue;
        if (!called.has(m[1])) called.set(m[1], path.relative(process.cwd(), file));
      }
    }

    const wm = new WidgetManager();
    const missing = [...called.entries()]
      .filter(([name]) => typeof wm[name] !== 'function')
      .map(([name, file]) => `${name} (called in ${file})`);
    expect(missing).toEqual([]);
  });
});
