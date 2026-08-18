import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ErrorType,
  VTTError,
  showErrorNotification,
} from '../errorHandling.js';
import { VTT_EVENTS } from '../constants.js';

describe('VTTError', () => {
  it('is instanceof Error with correct type, message, and optional originalError', () => {
    const root = new Error('root');
    const e = new VTTError(ErrorType.VALIDATION, 'bad input', root);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('VTTError');
    expect(e.message).toBe('bad input');
    expect(e.type).toBe(ErrorType.VALIDATION);
    expect(e.originalError).toBe(root);
  });

  it('getUserMessage returns type-specific strings and a fallback for unknowns', () => {
    const cases = [
      [ErrorType.WIDGET_INIT,  /reload/i],
      [ErrorType.STATE_READ,   /load game state/i],
      [ErrorType.STATE_WRITE,  /save changes/i],
      [ErrorType.NETWORK,      /Network error/i],
      [ErrorType.VALIDATION,   /Invalid data/i],
    ];
    for (const [type, pattern] of cases) {
      expect(new VTTError(type, 'x').getUserMessage()).toMatch(pattern);
    }
    expect(new VTTError('mystery', 'x').getUserMessage()).toMatch(/unexpected error/i);
  });
});

describe('showErrorNotification', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(window, 'dispatchEvent');
  });
  afterEach(() => {
    console.error.mockRestore();
    window.dispatchEvent.mockRestore();
  });

  it('dispatches vtt:error with user-friendly message and canRetry=false for VALIDATION', () => {
    showErrorNotification(new VTTError(ErrorType.VALIDATION, 'bad'));
    const [event] = window.dispatchEvent.mock.calls[0];
    expect(event.type).toBe(VTT_EVENTS.ERROR);
    expect(event.detail.message).toMatch(/Invalid data/i);
    expect(event.detail.canRetry).toBe(false);
  });

  it('canRetry is true for NETWORK errors', () => {
    showErrorNotification(new VTTError(ErrorType.NETWORK, 'timeout'));
    expect(window.dispatchEvent.mock.calls[0][0].detail.canRetry).toBe(true);
  });

  it('handles plain Error gracefully', () => {
    showErrorNotification(new Error('raw'));
    expect(window.dispatchEvent.mock.calls[0][0].detail.message).toMatch(/unexpected error/i);
  });
});

