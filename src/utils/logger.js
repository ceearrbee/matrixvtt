/**
 * Centralized logger. Every `logger.*` call fans out to:
 *   1. The console at the matching level (respecting dev/prod policy).
 *   2. Every registered sink - used by the in-page dev log panel and
 *      any other consumer that would otherwise monkey-patch console.
 *
 * Sinks are the supported extension point; new dev tools should
 * `addLogSink(fn)` rather than wrap `console.warn` globally. That keeps
 * the pipeline ordering explicit and removes the order-dependence
 * between competing interceptors.
 */

const IS_DEV = typeof import.meta.env !== 'undefined' ? import.meta.env.DEV : true;

const shouldLog = (level) => {
  if (IS_DEV) return true;
  return level === 'error';
};

const formatMessage = (prefix, message) => `[${prefix}] ${message}`;

let errorCount = 0;
const sinks = new Set();

/**
 * Register a function to receive every logged event. Returns an
 * unsubscribe handle. Sinks are called synchronously after the console
 * write, never before it - the console record stays authoritative.
 */
export function addLogSink(fn) {
  if (typeof fn !== 'function') {
    console.error('[logger] addLogSink called with non-function:', fn);
    return () => {};
  }
  sinks.add(fn);
  return () => sinks.delete(fn);
}

function _fanout(level, prefix, message, args) {
  for (const fn of sinks) {
    try { fn({ level, prefix, message, args }); }
    catch { /* a broken sink must not break logging */ }
  }
}

export const logger = {
  getErrorCount: () => errorCount,
  resetErrorCount: () => { errorCount = 0; },

  log: (prefix, message, ...args) => {
    if (shouldLog('log')) console.log(formatMessage(prefix, message), ...args);
    _fanout('log', prefix, message, args);
  },

  warn: (prefix, message, ...args) => {
    if (shouldLog('warn')) console.warn(formatMessage(prefix, message), ...args);
    _fanout('warn', prefix, message, args);
  },

  error: (prefix, message, ...args) => {
    errorCount++;
    if (shouldLog('error')) console.error(formatMessage(prefix, message), ...args);
    _fanout('error', prefix, message, args);
    window.dispatchEvent(new CustomEvent('vtt:debug-refresh', { detail: { count: errorCount } }));
  },

  debug: (prefix, message, ...args) => {
    if (shouldLog('debug')) console.debug(formatMessage(prefix, message), ...args);
    _fanout('debug', prefix, message, args);
  },
};
