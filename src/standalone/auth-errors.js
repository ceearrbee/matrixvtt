/**
 * Friendly translations for Matrix homeserver errors that surface
 * during login / SSO / join. Replaces the raw `err.message` strings
 * users would otherwise see ("M_FORBIDDEN: Invalid username or
 * password" etc.). New users hitting bad-password or rate-limit need
 * actionable copy, not Matrix-isms.
 *
 * Used by both the auth flow (login + SSO callback) and the join
 * flow (`_describeJoinError` in session.js); the shared helper lets
 * both paths agree on copy for shared errcodes like
 * `M_LIMIT_EXCEEDED`.
 */

import { isConnectionLostError } from '../utils/connection-error.js';

function _errcodeOf(err) {
  return err?.errcode || err?.data?.errcode || null;
}

// matrix-js-sdk surfaces unreachable homeservers as a ConnectionError
// whose message ("fetch failed") means nothing to a user typing a URL.
function _isNetworkError(err) {
  if (isConnectionLostError(err)) return true;
  const message = typeof err?.message === 'string' ? err.message : '';
  return err?.name === 'ConnectionError' || /fetch failed/i.test(message);
}

const NETWORK_MESSAGE = 'Could not reach the homeserver. Check the URL and your connection.';

/**
 * Server-hinted wait (ms) from a 429 response, or 0. The login form
 * uses this to hold the submit button instead of inviting a retry
 * loop that resets the rate-limit window.
 * @param {unknown} err
 */
export function loginRetryAfterMs(err) {
  const e = /** @type {any} */ (err);
  const ms = Number(e?.data?.retry_after_ms ?? e?.retry_after_ms);
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

const AUTH_MESSAGES = {
  M_FORBIDDEN: 'Wrong username or password. Check your details and try again.',
  M_LIMIT_EXCEEDED: 'Server rate limit reached. Wait a moment and try again.',
  M_USER_DEACTIVATED: 'This account has been deactivated. Contact your homeserver administrator.',
  M_UNKNOWN_TOKEN: 'Your session has expired. Please sign in again.',
  M_MISSING_TOKEN: 'Your session has expired. Please sign in again.',
  M_UNAUTHORIZED: 'Your session has expired. Please sign in again.',
  M_INVALID_USERNAME: 'That username is not valid for this homeserver.',
};

const REGISTER_MESSAGES = {
  M_USER_IN_USE: 'That username is already taken. Pick another.',
  M_EXCLUSIVE: 'That username is reserved on this homeserver. Pick another.',
  M_INVALID_USERNAME: 'That username is not valid for this homeserver. Use lowercase letters, digits, and . _ = - /.',
  M_WEAK_PASSWORD: 'That password is too weak for this homeserver. Use a longer or more varied one.',
  M_THREEPID_IN_USE: 'That email address is already tied to an account on this homeserver.',
  M_THREEPID_DENIED: 'This homeserver does not accept that email address.',
  M_FORBIDDEN: 'This homeserver does not allow open registration.',
  M_LIMIT_EXCEEDED: 'Server rate limit reached. Wait a moment and try again.',
};

const JOIN_MESSAGES = {
  M_FORBIDDEN: (target) => `Cannot join ${target}: the room is private and you have no invite. Ask the GM to invite you, or check the ID/alias.`,
  M_NOT_FOUND: (target) => `Room ${target} not found on this homeserver. Check the ID/alias and try again.`,
  M_UNKNOWN: (target) => `Room ${target} not found on this homeserver. Check the ID/alias and try again.`,
  M_LIMIT_EXCEEDED: () => 'Server rate limit reached. Wait a moment and try again.',
  M_UNKNOWN_TOKEN: () => 'Your session has expired. Please sign in again.',
  M_MISSING_TOKEN: () => 'Your session has expired. Please sign in again.',
};

/**
 * @param {unknown} err
 * @param {{context?: 'login' | 'sso' | 'join' | 'register', target?: string}} [opts]
 * @returns {string}
 */
export function describeAuthError(err, opts = {}) {
  if (!err) {
    return opts.context === 'join'
      ? `Could not join${opts.target ? ' ' + opts.target : ''}.`
      : 'Login failed. Try again.';
  }
  const message = /** @type {string} */ (
    typeof err === 'object' && err && 'message' in err
      ? /** @type {{message?: unknown}} */ (err).message
      : ''
  ) || 'unknown error';
  const code = _errcodeOf(err);
  if (!code && _isNetworkError(err)) return NETWORK_MESSAGE;
  if (opts.context === 'register') {
    const reg = REGISTER_MESSAGES[code];
    if (reg) return reg;
    return `Could not create the account: ${message}`;
  }
  if (opts.context === 'join') {
    const join = JOIN_MESSAGES[code];
    if (join) return join(opts.target ?? 'the room');
    return `Could not join${opts.target ? ' ' + opts.target : ''}: ${message}`;
  }
  const auth = AUTH_MESSAGES[code];
  if (auth) return auth;
  if (opts.context === 'sso') return `SSO sign-in failed: ${message}`;
  return message || 'Login failed. Try again.';
}
