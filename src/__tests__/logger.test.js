/**
 * logger.js - sink fanout, error counter, debug-refresh dispatch.
 * The module is load-bearing for the dev log panel; this test pins
 * the public contract so future cleanup can't silently break it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, addLogSink } from '../utils/logger.js';

describe('logger', () => {
  let warnSpy;
  let errorSpy;
  let logSpy;

  beforeEach(() => {
    logger.resetErrorCount();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('addLogSink returns an unsubscribe handle that actually unsubscribes', () => {
    const sink = vi.fn();
    const unsub = addLogSink(sink);
    logger.warn('A', 'first');
    expect(sink).toHaveBeenCalledTimes(1);
    unsub();
    logger.warn('A', 'second');
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it('addLogSink is a no-op for non-function input and still returns a callable handle', () => {
    const unsub = addLogSink('not a function');
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
  });

  it('logger.error increments getErrorCount', () => {
    expect(logger.getErrorCount()).toBe(0);
    logger.error('X', 'boom');
    logger.error('X', 'again');
    expect(logger.getErrorCount()).toBe(2);
  });

  it('logger.error dispatches vtt:debug-refresh with the new count', () => {
    const events = [];
    const listener = (e) => events.push(e.detail);
    window.addEventListener('vtt:debug-refresh', listener);
    try {
      logger.error('X', 'boom');
      logger.error('X', 'again');
    } finally {
      window.removeEventListener('vtt:debug-refresh', listener);
    }
    expect(events).toEqual([{ count: 1 }, { count: 2 }]);
  });

  it('sinks fan out after the console write (ordering)', () => {
    const order = [];
    warnSpy.mockImplementation(() => order.push('console'));
    const unsub = addLogSink(() => order.push('sink'));
    try {
      logger.warn('Tag', 'msg');
    } finally {
      unsub();
    }
    expect(order).toEqual(['console', 'sink']);
  });

  it('a throwing sink does not break the pipeline for other sinks', () => {
    const good = vi.fn();
    const unsubBad = addLogSink(() => { throw new Error('bad sink'); });
    const unsubGood = addLogSink(good);
    try {
      expect(() => logger.warn('T', 'm')).not.toThrow();
    } finally {
      unsubBad();
      unsubGood();
    }
    expect(good).toHaveBeenCalledTimes(1);
  });

  it('passes prefix, message, and args through to sinks', () => {
    const sink = vi.fn();
    const unsub = addLogSink(sink);
    try {
      logger.log('Net', 'hello', 1, { x: 2 });
    } finally {
      unsub();
    }
    expect(sink).toHaveBeenCalledWith({
      level: 'log',
      prefix: 'Net',
      message: 'hello',
      args: [1, { x: 2 }],
    });
  });

  it('resetErrorCount returns the counter to zero', () => {
    logger.error('X', 'boom');
    expect(logger.getErrorCount()).toBe(1);
    logger.resetErrorCount();
    expect(logger.getErrorCount()).toBe(0);
  });
});
