/**
 * `useStorageSubscription(key, options)` - Preact hook that reads a
 * value from localStorage AND subscribes to the cross-tab `storage`
 * event so a write in another tab updates this tab's UI too.
 *
 * Returns `[value, setValue]`. `setValue` writes to localStorage and
 * updates the local state synchronously; the `storage` event doesn't
 * fire in the writing tab, so the local-update keeps the in-tab view
 * fresh. Other tabs get the update via the event listener.
 *
 * Optional `options.parse` / `options.serialize` lets you treat the
 * stored value as something other than a raw string (e.g., '1' for
 * a boolean dismiss flag).
 *
 * localStorage access is wrapped in try/catch to survive Firefox's
 * Enhanced Tracking Protection blocking it.
 */
import { useEffect, useState } from 'preact/hooks';

/**
 * @template T
 * @param {string} key
 * @param {{ parse?: (raw: string | null) => T, serialize?: (value: T) => string }} [options]
 * @returns {[T, (next: T) => void]}
 */
export function useStorageSubscription(key, options = {}) {
  const { parse = /** @type {any} */ ((v) => v), serialize = /** @type {any} */ ((v) => v) } = options;

  const readNow = () => {
    try { return parse(localStorage.getItem(key)); }
    catch { return parse(null); }
  };

  const [value, setLocalValue] = useState(readNow);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== key) return;
      setLocalValue(parse(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  const setValue = (next) => {
    try { localStorage.setItem(key, serialize(next)); }
    catch { /* ETP blocked - keep local state in sync anyway */ }
    setLocalValue(next);
  };

  return [value, setValue];
}
