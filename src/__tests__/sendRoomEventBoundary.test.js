/**
 * Lint guard: feature code under `src/ui/**` and `src/map/**` must not
 * call `.sendRoomEvent(…)` directly on widgetManager / clientManager.
 * Every outbound room event must route through the StateManager facade
 * (`ui.state.sendRoomEvent` / `mr.state.sendRoomEvent`) so 429/5xx
 * responses land in the retry queue instead of failing silently.
 *
 * Bridge-level uses inside `src/state/**`, `src/widget/**`, and
 * `src/client/**` are exempt - they implement the queue itself.
 *
 * The allowlist whitelists calls on a StateManager-like receiver
 * (`.state.sendRoomEvent(`) since those go through the queue.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const UI_DIR  = resolve(process.cwd(), 'src/ui');
const MAP_DIR = resolve(process.cwd(), 'src/map');

// Matches any `.sendRoomEvent(` invocation. The receiver is checked
// below so `state.sendRoomEvent(...)` / `ui.state.sendRoomEvent(...)`
// / `mr.state.sendRoomEvent(...)` are accepted (those route through
// the queue) and bare `widgetManager.sendRoomEvent(...)` is flagged.
const SEND_CALL_RE = /\.sendRoomEvent\s*\(/;
const VIA_STATE_RE = /\bstate\.sendRoomEvent\s*\(/;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (/\.(js|jsx)$/.test(entry)) yield full;
  }
}

function scan(rootDir, prefix) {
  const hits = [];
  for (const file of walk(rootDir)) {
    const rel = prefix + relative(rootDir, file);
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('*') || trimmed.startsWith('//')) return;
      if (!SEND_CALL_RE.test(line)) return;
      if (VIA_STATE_RE.test(line)) return;
      hits.push({ loc: `${rel}:${i + 1}`, line: trimmed });
    });
  }
  return hits;
}

describe('sendRoomEvent boundary - feature modules route through the queue', () => {
  it('no raw `.sendRoomEvent(` calls in src/ui/** or src/map/** outside the queue facade', () => {
    const hits = [...scan(UI_DIR, 'src/ui/'), ...scan(MAP_DIR, 'src/map/')];
    if (hits.length) {
      const msg = hits.map((h) => `  ${h.loc}  ${h.line}`).join('\n');
      throw new Error(
        `Raw .sendRoomEvent(…) call(s) found in feature modules - route through ui.state.sendRoomEvent / mr.state.sendRoomEvent:\n${msg}`,
      );
    }
    expect(hits).toHaveLength(0);
  });
});
