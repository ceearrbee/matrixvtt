/**
 * All outbound Matrix writes must funnel through state/queue.js so 429
 * rate-limit responses get queued and retried. Calling
 * `widgetManager.sendRoomEvent` / `widgetManager.sendStateEvent`
 * directly from application code skips the retry queue and silently
 * loses the write on the next homeserver hiccup.
 *
 * Sub-project D in the production-readiness master plan called this
 * out after several sites were found bypassing the queue. They've been
 * routed through `state.sendRoomEvent` / `state.sendStateEvent`; this
 * test pins the discipline so it doesn't drift back.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

// Walk src/ and collect .js / .jsx that aren't tests / vendor.
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = resolve(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      walk(path, out);
    } else if (/\.(jsx?|jsx)$/.test(name) && !name.endsWith('.test.js') && !name.endsWith('.test.jsx')) {
      out.push(path);
    }
  }
  return out;
}

// The queue module owns the only legitimate calls; the transport layer
// (widget/, client/) is the implementation of sendRoomEvent itself.
const ALLOWED_PREFIXES = [
  'state/queue.js',
  'widget/',
  'client/',
];

function isAllowed(path) {
  const rel = relative(root, path).replace(/\\/g, '/');
  return ALLOWED_PREFIXES.some((p) => rel === p || rel.startsWith(p));
}

const PATTERN = /widgetManager\??\.\s*(sendRoomEvent|sendStateEvent)\s*\(/;

describe('queue routing - no widgetManager bypasses outside state/queue.js', () => {
  it('every outbound write funnels through the retry queue', () => {
    const offenders = [];
    for (const path of walk(root)) {
      if (isAllowed(path)) continue;
      const src = readFileSync(path, 'utf8');
      if (PATTERN.test(src)) offenders.push(relative(root, path));
    }
    expect(offenders, `\nThese files bypass state/queue.js by calling widgetManager.send*Event directly:\n  - ${offenders.join('\n  - ')}\nRoute them through state.sendRoomEvent / state.sendStateEvent instead.\n`).toEqual([]);
  });
});
