/**
 * WidgetApi (matrix-widget-stub) tests - handler validation
 */

import { describe, it, expect } from 'vitest';
import { WidgetApi } from '../matrix-widget-stub.js';

describe('WidgetApi.on - handler validation', () => {
  it('throws TypeError when handler is not a function', () => {
    const api = new WidgetApi();
    expect(() => api.on('timeline', 'not-a-function')).toThrow(TypeError);
  });

  it('throws TypeError when handler is null', () => {
    const api = new WidgetApi();
    expect(() => api.on('timeline', null)).toThrow(TypeError);
  });

  it('accepts a valid function handler', () => {
    const api = new WidgetApi();
    expect(() => api.on('timeline', () => {})).not.toThrow();
  });
});

describe('WidgetApi.emit - calls registered handlers', () => {
  it('calls the registered handler with event data', () => {
    const api = new WidgetApi();
    const received = [];
    api.on('timeline', (data) => received.push(data));
    api.emit('timeline', { type: 'm.room.message' });
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('m.room.message');
  });

  it('does not throw for event type with no handlers', () => {
    const api = new WidgetApi();
    expect(() => api.emit('unknown', {})).not.toThrow();
  });
});
