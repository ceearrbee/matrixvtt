/**
 * Classify an Error as "the network/transport itself broke" - i.e. the
 * recovery is a page reload, not anything code-level can do. Two
 * symptoms qualify:
 *
 *   1. Dynamic `import(url)` rejected with TypeError because the
 *      browser couldn't fetch the module. Firefox phrases this as
 *      "error loading dynamically imported module"; Chrome as
 *      "Failed to fetch dynamically imported module".
 *   2. A vanilla `fetch()` rejected before the request reached the
 *      wire - Firefox surfaces this as "NetworkError when attempting
 *      to fetch resource", Chrome as "Failed to fetch".
 *
 * Both share a common cause on flaky mobile networks: the browser's
 * HTTP/2 connection pool holds a TCP socket that died silently during
 * a WiFi flap, and subsequent requests fast-fail without a real
 * network attempt. No retry can recover that pool - only a full page
 * reload forces it to be torn down.
 *
 * Be conservative: false positives reload the page on genuine code
 * errors. Only match patterns observed from real disconnects.
 */
const PATTERNS = [
  /error loading dynamically imported module/i,
  /failed to fetch dynamically imported module/i,
  /networkerror when attempting to fetch/i,
  /^failed to fetch$/i,
  /load failed/i, // Safari iOS
];

/**
 * @param {unknown} err
 * @returns {boolean}
 */
export function isConnectionLostError(err) {
  if (!err) return false;
  const message = /** @type {any} */ (err).message;
  if (typeof message !== 'string') return false;
  return PATTERNS.some((p) => p.test(message));
}
