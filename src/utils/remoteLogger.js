/**
 * Remote Logger - forwards browser `console.*` output to the Vite dev
 * server's `/log` endpoint so the terminal + `vtt-dev.log` see
 * everything a live tab prints. Enabled only in dev (`import.meta.env.DEV`).
 *
 * This is the *only* module allowed to patch global `console.*`. The
 * in-page app-log panel (`standalone/app-log.js`) and every other
 * consumer register as sinks on `utils/logger.js` via `addLogSink`.
 */

const REMOTE_LOGGING_ENABLED = import.meta.env.DEV;
const LOG_ENDPOINT = `${window.location.origin}/log`;

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;
const originalInfo = console.info;
const originalDebug = console.debug;

/**
 * Patterns we silence at the console wrapper level. matrix-js-sdk's
 * scheduler logs "Stopping queue 'message' as it is now empty" at info
 * every time its send-queue drains - once per dice roll, chat send, or
 * any other outbound event. The message is operational noise and
 * drowns out actually-useful logs both locally and on the dev server.
 *
 * Add patterns sparingly - only third-party operational logs the dev
 * cannot turn off at the source.
 */
const NOISE_PATTERNS = [
  /^Stopping queue '[^']+' as it is now empty/,
];

function isNoise(args) {
  const first = args[0];
  if (typeof first !== 'string') return false;
  return NOISE_PATTERNS.some(p => p.test(first));
}

/**
 * JSON.stringify drops Error.message and Error.stack because they're
 * non-enumerable. That's why `VTT init failed: {}` shows up in the log
 * for any error path. Recursively replace Error instances with a plain
 * object carrying the diagnostic fields.
 */
function unpackForJson(value, seen = new WeakSet()) {
  if (value instanceof Error) {
    // Matrix SDK errors carry extra fields (errcode, code, data) past
    // the Error interface; cast through any so JSDoc/tsc stays happy.
    const e = /** @type {any} */ (value);
    return {
      __error: true,
      name: e.name,
      message: e.message,
      stack: e.stack,
      code: e.code,
      errcode: e.errcode,
      data: e.data,
    };
  }
  if (value && typeof value === 'object') {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    if (Array.isArray(value)) return value.map((v) => unpackForJson(v, seen));
    const out = {};
    for (const k of Object.keys(value)) out[k] = unpackForJson(value[k], seen);
    return out;
  }
  return value;
}

async function sendToServer(level, args) {
  if (!REMOTE_LOGGING_ENABLED) return;

  const firstArg = args[0];
  let prefix = 'Widget';
  let message = firstArg;
  const restArgs = args.slice(1);

  // Extract [Prefix] from message format
  if (typeof firstArg === 'string') {
    const match = firstArg.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (match) {
      prefix = match[1];
      message = match[2];
    }
  }

  try {
    const response = await fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level,
        prefix,
        message,
        args: restArgs.map((a) => unpackForJson(a)),
      })
    });
    if (!response.ok) {
      originalWarn.call(console, `[RemoteLogger] Failed to send log: ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    originalWarn.call(console, `[RemoteLogger] Connection failed: ${err.message}`);
  }
}

export function initRemoteLogging() {
  if (!REMOTE_LOGGING_ENABLED) {
    return;
  }

  console.log = function(...args) {
    if (isNoise(args)) return;
    originalLog.apply(console, args);
    sendToServer('log', args);
  };

  console.warn = function(...args) {
    if (isNoise(args)) return;
    originalWarn.apply(console, args);
    sendToServer('warn', args);
  };

  console.error = function(...args) {
    if (isNoise(args)) return;
    originalError.apply(console, args);
    sendToServer('error', args);
  };

  console.info = function(...args) {
    if (isNoise(args)) return;
    originalInfo.apply(console, args);
    sendToServer('info', args);
  };

  console.debug = function(...args) {
    if (isNoise(args)) return;
    originalDebug.apply(console, args);
    sendToServer('debug', args);
  };

  originalLog.call(console, `[RemoteLogger] Remote logging enabled → terminal + vtt-dev.log (Endpoint: ${LOG_ENDPOINT})`);
}
