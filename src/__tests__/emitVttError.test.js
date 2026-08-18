/**
 * emitVttError - the shared error-dispatch helper.
 *
 * The map action modules (combat / fog / tokens) must share this one
 * implementation. This test pins it down so per-module copies don't
 * drift back in.
 */

import { describe, it, expect, vi } from 'vitest';
import { emitVttError } from '../utils/errorHandling.js';
import { VTT_EVENTS } from '../utils/constants.js';

describe('emitVttError', () => {
  it('dispatches a VTT_EVENTS.ERROR CustomEvent on window with message + error in detail', () => {
    const handler = vi.fn();
    window.addEventListener(VTT_EVENTS.ERROR, handler);

    const err = new Error('boom');
    emitVttError('Failed to do the thing', err);

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0];
    expect(event.detail.message).toBe('Failed to do the thing');
    expect(event.detail.error).toBe(err);

    window.removeEventListener(VTT_EVENTS.ERROR, handler);
  });

  it('works when error argument is omitted (undefined passes through)', () => {
    const handler = vi.fn();
    window.addEventListener(VTT_EVENTS.ERROR, handler);

    emitVttError('Just a message');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.message).toBe('Just a message');
    expect(handler.mock.calls[0][0].detail.error).toBeUndefined();

    window.removeEventListener(VTT_EVENTS.ERROR, handler);
  });
});
