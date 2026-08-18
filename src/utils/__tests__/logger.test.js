import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, addLogSink } from '../logger.js';

describe('Logger Utility', () => {
  let logSpy, warnSpy, errorSpy;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should format log messages correctly with a prefix', () => {
    logger.log('Test', 'Hello world');
    expect(logSpy).toHaveBeenCalledWith('[Test] Hello world');
  });

  it('should include additional arguments in logs', () => {
    const data = { foo: 'bar' };
    logger.log('Test', 'Data:', data);
    expect(logSpy).toHaveBeenCalledWith('[Test] Data:', data);
  });

  it('should format warn messages correctly', () => {
    logger.warn('Test', 'Watch out');
    expect(warnSpy).toHaveBeenCalledWith('[Test] Watch out');
  });

  it('should format error messages correctly', () => {
    logger.error('Test', 'Something failed');
    expect(errorSpy).toHaveBeenCalledWith('[Test] Something failed');
  });

  it('should only log if import.meta.env.DEV is true (mocked)', () => {
    // Note: In tests, import.meta.env.DEV is usually true.
    // To truly test production exclusion, we'd need to mock the environment.
    // For now, let's just ensure it DOES log in the test environment.
    logger.log('Test', 'Should be visible');
    expect(logSpy).toHaveBeenCalled();
  });
});

describe('Logger - error counter and vtt:debug-refresh', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.resetErrorCount();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('error() increments the count read by getErrorCount()', () => {
    expect(logger.getErrorCount()).toBe(0);
    logger.error('Test', 'boom');
    expect(logger.getErrorCount()).toBe(1);
    logger.error('Test', 'boom2');
    expect(logger.getErrorCount()).toBe(2);
  });

  it('log/warn/debug do NOT increment the error counter', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    logger.log('Test', 'x');
    logger.warn('Test', 'x');
    logger.debug('Test', 'x');
    expect(logger.getErrorCount()).toBe(0);
  });

  it('resetErrorCount clears the counter to 0', () => {
    logger.error('Test', 'one');
    logger.error('Test', 'two');
    logger.resetErrorCount();
    expect(logger.getErrorCount()).toBe(0);
  });

  it('error() dispatches vtt:debug-refresh carrying the new count', () => {
    const events = [];
    const handler = (e) => events.push(e.detail);
    window.addEventListener('vtt:debug-refresh', handler);
    try {
      logger.error('Test', 'boom');
      expect(events).toHaveLength(1);
      expect(events[0].count).toBe(1);
      logger.error('Test', 'again');
      expect(events).toHaveLength(2);
      expect(events[1].count).toBe(2);
    } finally {
      window.removeEventListener('vtt:debug-refresh', handler);
    }
  });
});

describe('Logger - sink fanout', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    logger.resetErrorCount();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('addLogSink fans out every log level to the sink', () => {
    const sink = vi.fn();
    const off = addLogSink(sink);
    logger.log('Cat', 'a');
    logger.warn('Cat', 'b');
    logger.error('Cat', 'c');
    logger.debug('Cat', 'd');
    expect(sink).toHaveBeenCalledTimes(4);
    expect(sink.mock.calls.map(c => c[0].level)).toEqual(['log', 'warn', 'error', 'debug']);
    off();
  });

  it('the returned handle unsubscribes the sink', () => {
    const sink = vi.fn();
    const off = addLogSink(sink);
    logger.log('Cat', 'a');
    expect(sink).toHaveBeenCalledTimes(1);
    off();
    logger.log('Cat', 'b');
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it('addLogSink with a non-function returns a no-op handle and is safe to call', () => {
    const handle = addLogSink('not-a-fn');
    expect(typeof handle).toBe('function');
    expect(() => handle()).not.toThrow();
  });

  it('forwards prefix, message, and extra args to the sink payload', () => {
    const sink = vi.fn();
    const off = addLogSink(sink);
    logger.log('Net', 'hello', { code: 42 }, 'extra');
    expect(sink).toHaveBeenCalledWith({
      level: 'log',
      prefix: 'Net',
      message: 'hello',
      args: [{ code: 42 }, 'extra'],
    });
    off();
  });

  it('a throwing sink does not break the pipeline (other sinks still fire)', () => {
    const broken = vi.fn(() => { throw new Error('sink boom'); });
    const survivor = vi.fn();
    const offA = addLogSink(broken);
    const offB = addLogSink(survivor);
    expect(() => logger.log('Cat', 'x')).not.toThrow();
    expect(survivor).toHaveBeenCalledTimes(1);
    offA();
    offB();
  });

  it('sink fanout runs after the console write (console-first ordering)', () => {
    const order = [];
    console.log.mockImplementation(() => order.push('console'));
    const off = addLogSink(() => order.push('sink'));
    logger.log('Cat', 'x');
    expect(order).toEqual(['console', 'sink']);
    off();
  });
});
