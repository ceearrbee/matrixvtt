/**
 * Lint guard: feature code under `src/ui/**` and `src/map/**` must not
 * call `ui.state.sendStateEvent(…)` / `mr.state.sendStateEvent(…)` /
 * `state.sendStateEvent(…)` directly. Those sites bypass the
 * StateManager facade and the validation + retry + notify invariants
 * the writer layer provides.
 *
 * Legitimate bridge-level uses live in the state layer itself
 * (`src/state/**`) and are exempt from this check.
 *
 * Whitelist is explicit; every entry must cite a reason. When a new
 * entry legitimately needs the raw channel (e.g. a custom event shape
 * no writer covers), add it to `ALLOWED` with a short justification.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const UI_DIR  = resolve(process.cwd(), 'src/ui');
const MAP_DIR = resolve(process.cwd(), 'src/map');

// Matches any `.sendStateEvent(` call (method invocation). Does not match
// the getter `sendStateEvent: foo` in a mock object literal.
const SEND_CALL_RE = /\.sendStateEvent\s*\(/;

/**
 * The allowlist is intentionally empty - every prior exception has
 * been replaced by an explicit facade method:
 *   - `sm.clearDrawings()` covers the initial-save drawings clear.
 *   - `sm.tombstoneForeignEvent(type, id)` covers the tombstone-sweep
 *     fallback for unmapped event types.
 * If a new use case needs a raw send, add a new facade method first
 * and keep this list empty.
 */
const ALLOWED = [];

function isAllowed(hit) {
  return ALLOWED.some((a) => hit.file === a.file && hit.line === a.content);
}

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
      if (SEND_CALL_RE.test(line)) {
        hits.push({ file: rel, loc: `${rel}:${i + 1}`, line: trimmed });
      }
    });
  }
  return hits;
}

describe('sendStateEvent boundary - feature modules route through the facade', () => {
  it('no raw `.sendStateEvent(` calls in src/ui/** or src/map/** outside the whitelist', () => {
    const hits = [
      ...scan(UI_DIR,  'src/ui/'),
      ...scan(MAP_DIR, 'src/map/'),
    ];
    const unexpected = hits.filter((h) => !isAllowed(h));
    if (unexpected.length) {
      const msg = unexpected
        .map((h) => `  ${h.loc}  ${h.line}`)
        .join('\n');
      throw new Error(
        `Raw .sendStateEvent(…) call(s) found in feature modules - route through the StateManager facade:\n${msg}`,
      );
    }
    expect(unexpected).toHaveLength(0);
  });
});
