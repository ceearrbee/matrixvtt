/**
 * Vitest setup: fail tests on unexpected console.error / console.warn.
 *
 * Design: the gate is CHANNEL-AWARE. Anything routed through
 * `src/utils/logger.js` produces a `[Channel] message` prefix; those
 * are intentional production-error signals (network failures, state
 * write errors, migration warnings) and tests that exercise the
 * corresponding error path will fire them legitimately. The gate
 * ignores them by default.
 *
 * What the gate catches:
 *   - Raw `console.error('foo')` / `console.warn('foo')` with no
 *     channel prefix - the emoji-picker-storm bug class.
 *   - Preact / framework warnings about state updates on unmounted
 *     components, key collisions, hook order changes, etc.
 *   - Anything else not on the recognized-channels allow list below.
 *
 * Per-spec opt-in: call `expectConsoleError(/pattern/)` /
 * `expectConsoleWarning(/pattern/)` to whitelist a SPECIFIC message
 * for the current test (regex or substring match). Cleared after
 * the test.
 *
 * Escape hatch: `VTT_ALLOW_CONSOLE=1` disables the gate entirely
 * (useful while triaging a noisy spec).
 */

import { afterEach, beforeEach, vi } from 'vitest';

const DISABLED = process.env.VTT_ALLOW_CONSOLE === '1';

// Intentional channel prefixes - emitted by `src/utils/logger.js` and
// well-known third-party libraries that produce stable warning shapes.
// Output matching any of these is allowed without per-test whitelisting.
//
// To suppress a NEW channel at source rather than allow-list it, edit
// the offending call site to use `logger.debug(...)` or remove the log.
const INTENTIONAL_CHANNELS = [
  // Logger output: `[<word>] ...`
  /^\[[A-Za-z][\w]*\]\s/,
  // Konva itself emits these from real prod-Konva - separate cleanup
  // to silence at the layer-tree level if we ever care.
  /^Konva warning:\s/,
];

let allowed = [];
let unexpected = [];

function format(args) {
  return args.map((a) => {
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch { return String(a); }
  }).join(' ');
}

function matches(message, pattern) {
  if (pattern instanceof RegExp) return pattern.test(message);
  if (typeof pattern === 'string') return message.includes(pattern);
  return false;
}

function isIntentional(message) {
  return INTENTIONAL_CHANNELS.some((re) => re.test(message));
}

globalThis.expectConsoleError = (pattern) => {
  allowed.push(pattern);
};
globalThis.expectConsoleWarning = (pattern) => {
  allowed.push(pattern);
};

function captureIfUnexpected(...args) {
  const message = format(args);
  if (isIntentional(message)) return;
  const idx = allowed.findIndex((p) => matches(message, p));
  if (idx === -1) {
    unexpected.push(message);
  } else {
    allowed.splice(idx, 1);
  }
}

beforeEach(() => {
  if (DISABLED) return;
  allowed = [];
  unexpected = [];
  vi.spyOn(console, 'error').mockImplementation(captureIfUnexpected);
  vi.spyOn(console, 'warn').mockImplementation(captureIfUnexpected);
});

afterEach((ctx) => {
  if (DISABLED) return;
  // Don't fail tests that were already failing for other reasons -
  // the original failure is more informative.
  const alreadyFailed = ctx?.task?.result?.state === 'fail';
  vi.restoreAllMocks();
  const captured = unexpected;
  unexpected = [];
  allowed = [];
  if (alreadyFailed || captured.length === 0) return;
  throw new Error(
    `Test emitted ${captured.length} unexpected console.error/warn call(s):\n` +
    captured.map((m, i) => `  [${i + 1}] ${m}`).join('\n') +
    `\n(Whitelist with expectConsoleError(/pattern/) if intentional, ` +
    `or set VTT_ALLOW_CONSOLE=1 while triaging.)`
  );
});
