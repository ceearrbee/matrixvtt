/**
 * SubscriptionManager unit tests - error dispatch
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { throwError, of, Subject } from 'rxjs';
import { SubscriptionManager } from '../SubscriptionManager.js';

describe('SubscriptionManager - error dispatch', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('dispatches vtt:error when subscription permanently fails after retries', async () => {
    const sm = new SubscriptionManager();
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail));

    sm.subscribe('test-sub', throwError(() => new Error('permanent failure')), vi.fn());

    // Advance through 3 retry delays (1s, 2s, 4s)
    await vi.runAllTimersAsync();

    window.removeEventListener('vtt:error', errors[0] ? (() => {}) : (() => {}));
    sm.destroy();

    expect(errors).toHaveLength(1);
  });

  it('does not dispatch vtt:error when subscription succeeds', async () => {
    const sm = new SubscriptionManager();
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail));

    const onNext = vi.fn();
    sm.subscribe('test-sub', of(42), onNext);

    await vi.runAllTimersAsync();
    sm.destroy();

    window.removeEventListener('vtt:error', () => {});
    expect(errors).toHaveLength(0);
    expect(onNext).toHaveBeenCalledWith(42);
  });
});

describe('SubscriptionManager - name reuse is idempotent', () => {
  it('unsubscribes the prior subscription when subscribe() is called with the same name', () => {
    const sm = new SubscriptionManager();
    const subject = new Subject();
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    sm.subscribe('shared-name', subject, firstHandler);
    sm.subscribe('shared-name', subject, secondHandler);

    subject.next('payload');

    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalledWith('payload');
    sm.destroy();
  });
});
