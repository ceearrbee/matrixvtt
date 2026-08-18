/**
 * Subscription Manager - RxJS Lifecycle Management
 *
 * Manages RxJS subscriptions for Matrix state event observables.
 * Ensures proper cleanup and error handling for production use.
 */

import { Subject, EMPTY } from 'rxjs';
import { takeUntil, retry, catchError } from 'rxjs/operators';
import { VTTError, ErrorType, showErrorNotification } from '../utils/errorHandling.js';

export class SubscriptionManager {
  constructor() {
    // Subject for triggering unsubscribe on all subscriptions
    this.destroy$ = new Subject();

    // Track active subscriptions for debugging
    this.subscriptions = new Map();
  }

  /**
   * Subscribe to an observable or Preact signal with automatic lifecycle
   * management. Observables get the full retry+catchError pipeline; signals
   * are subscribed natively because they don't error and have no .pipe().
   *
   * @param {string} name - Subscription name for debugging
   * @param {import('rxjs').Observable<unknown> | { subscribe: (fn: Function) => () => void }} source -
   *   RxJS Observable or Preact signal
   * @param {Function} onNext - Handler for next values
   * @param {Function} [onError] - Optional error handler
   * @returns {{ unsubscribe: () => void }} The subscription (already tracked)
   */
  subscribe(name, source, onNext, onError = null) {
    // Idempotency: replace any prior subscription with the same name.
    // Without this, callers that re-wire bridges (e.g. on Yjs id changes)
    // would leak the old subscription each time and double-fire handlers.
    this.unsubscribe(name);

    if (typeof /** @type {any} */ (source).pipe !== 'function') {
      return this._subscribeSignal(name, /** @type {any} */ (source), onNext);
    }
    const observable = /** @type {import('rxjs').Observable<unknown>} */ (source);

    let pipeline = observable.pipe(
      // Automatically unsubscribe when destroy$ emits
      takeUntil(this.destroy$),

      // Retry on error (with exponential backoff)
      retry({
        count: 3,
        delay: (_error, retryCount) => {
          const delayMs = Math.min(1000 * Math.pow(2, retryCount), 10000);
          return new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }),

      catchError((error) => {
        showErrorNotification(new VTTError(ErrorType.SUBSCRIPTION, `${name} subscription failed after retries`, error));
        if (onError) {
          onError(error);
        }
        return EMPTY;
      })
    );

    // Subscribe and track
    const subscription = pipeline.subscribe({
      next: (value) => {
        try {
          onNext(value);
        } catch (error) {
          showErrorNotification(new VTTError(ErrorType.SUBSCRIPTION, `Error in ${name} handler`, error));
        }
      },
      error: (error) => {
        showErrorNotification(new VTTError(ErrorType.SUBSCRIPTION, `${name} subscription error`, error));
        if (onError) {
          onError(error);
        }
      }
    });

    this.subscriptions.set(name, subscription);
    return subscription;
  }

  _subscribeSignal(name, sig, onNext) {
    const unsub = sig.subscribe((value) => {
      try {
        onNext(value);
      } catch (error) {
        showErrorNotification(new VTTError(ErrorType.SUBSCRIPTION, `Error in ${name} handler`, error));
      }
    });
    const tracked = { unsubscribe: unsub };
    this.subscriptions.set(name, tracked);
    return tracked;
  }

  /**
   * Unsubscribe from a specific subscription by name
   */
  unsubscribe(name) {
    const subscription = this.subscriptions.get(name);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(name);
    }
  }

  /**
   * Unsubscribe from all subscriptions
   * Call this when the application is shutting down
   */
  destroy() {
    this.destroy$.next();
    this.destroy$.complete();
    // Signal-backed entries don't ride takeUntil; unsubscribe explicitly.
    // Calling unsubscribe() on already-completed RxJS subscriptions is safe.
    for (const sub of this.subscriptions.values()) sub.unsubscribe?.();
    this.subscriptions.clear();
  }

  /**
   * Get list of active subscriptions (for debugging)
   */
  getActiveSubscriptions() {
    return Array.from(this.subscriptions.keys());
  }
}
