/**
 * Error Handling Utilities
 *
 * Production-ready error handling with user-friendly messages and logging.
 */

import { logger } from './logger.js';
import { VTT_EVENTS } from './constants.js';

/**
 * Error types for classification
 */
export const ErrorType = {
  WIDGET_INIT: 'widget_initialization',
  STATE_READ: 'state_read',
  STATE_WRITE: 'state_write',
  SUBSCRIPTION: 'subscription',
  VALIDATION: 'validation',
  NETWORK: 'network',
  PERMISSION: 'permission',
  UNKNOWN: 'unknown'
};

/**
 * Application error with type classification
 */
export class VTTError extends Error {
  constructor(type, message, originalError = null) {
    super(message);
    this.name = 'VTTError';
    this.type = type;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage() {
    switch (this.type) {
      case ErrorType.WIDGET_INIT:
        return 'Failed to initialize Matrix widget. Please reload and try again.';

      case ErrorType.STATE_READ:
        return 'Could not load game state from Matrix. You may see outdated data.';

      case ErrorType.STATE_WRITE:
        return 'Could not save changes to Matrix. Your changes may not be visible to others.';

      case ErrorType.SUBSCRIPTION:
        return 'Lost connection to Matrix updates. Trying to reconnect...';

      case ErrorType.VALIDATION:
        return 'Invalid data detected. Changes have been discarded.';

      case ErrorType.NETWORK:
        return 'Network error. Please check your connection.';

      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Log error with context
   */
  log(context = '') {
    logger.error(context || 'VTTError', `[${this.type}] ${this.message}`);

    if (this.originalError) {
      logger.error(context || 'VTTError', 'Original error:', this.originalError);
    }
  }
}

/**
 * Dispatch a VTT_EVENTS.ERROR CustomEvent so the UI can surface an
 * error toast. The UIController's window listener picks this up and
 * passes it to the notification system.
 */
export function emitVttError(message, error) {
  window.dispatchEvent(new CustomEvent(VTT_EVENTS.ERROR, { detail: { message, error } }));
}

/**
 * Show error notification to user
 */
export function showErrorNotification(error) {
  const message = error instanceof VTTError
    ? error.getUserMessage()
    : 'An unexpected error occurred';

  window.dispatchEvent(new CustomEvent(VTT_EVENTS.ERROR, {
    detail: {
      message,
      error,
      canRetry: error.type !== ErrorType.VALIDATION
    }
  }));

  // Also log to console
  if (error instanceof VTTError) {
    error.log('ErrorNotification');
  } else {
    logger.error('ErrorNotification', error);
  }
}

/**
 * Produce a short, user-facing description of a network / Matrix error.
 * Prefers the homeserver's `errcode` (e.g. `M_FORBIDDEN`, `M_LIMIT_EXCEEDED`)
 * when available, falls back to the raw `message`, then to a generic line.
 *
 * Intended for toasts - callers prefix with their own action context, e.g.:
 *   ui._toast(`Couldn't send the roll. ${describeNetworkError(err)}`);
 */
export function describeNetworkError(err) {
  const code = err?.errcode || err?.data?.errcode;
  if (code === 'M_LIMIT_EXCEEDED') {
    return 'Server rate limit reached. Wait a few seconds and try again.';
  }
  if (code === 'M_FORBIDDEN') {
    return 'Permission denied by the homeserver. Check your role in this room.';
  }
  if (code === 'M_UNKNOWN' || err?.status === 500) {
    return 'The homeserver responded with an error. Try again in a moment.';
  }
  if (err?.status === 0 || /network|offline|fetch/i.test(err?.message || '')) {
    return 'Network unreachable. Check your connection.';
  }
  return err?.message ? `Error: ${err.message}` : 'Something went wrong. Try again.';
}
