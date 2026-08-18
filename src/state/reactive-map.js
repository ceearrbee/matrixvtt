/**
 * reactive-map.js - Map-shaped wrapper around a `@preact/signals`
 * signal. Mutations (`set`, `delete`, `clear`) reassign the signal
 * with a fresh Map reference, so any component or effect subscribed
 * to the signal re-runs automatically.
 *
 * Call-sites keep the familiar `map.get(id)` / `for (const [k,v] of
 * map)` / `map.size` shape. Reads always pass through the signal's
 * current value, so external writes to the signal (bulk replace via
 * `signal.value = new Map(...)`) are visible immediately.
 *
 * This is the storage primitive for `StateManager` entity
 * collections. Do not use for ephemeral caches that shouldn't
 * publish to the UI (e.g. the retry queue).
 */

export class ReactiveMap {
  /** @param {{ value: Map<any, any> }} signal */
  constructor(signal) {
    this._signal = signal;
  }

  get size() { return this._signal.value.size; }
  get(key) { return this._signal.value.get(key); }
  has(key) { return this._signal.value.has(key); }

  set(key, value) {
    const next = new Map(this._signal.value);
    next.set(key, value);
    this._signal.value = next;
    return this;
  }

  delete(key) {
    if (!this._signal.value.has(key)) return false;
    const next = new Map(this._signal.value);
    next.delete(key);
    this._signal.value = next;
    return true;
  }

  clear() {
    if (this._signal.value.size === 0) return;
    this._signal.value = new Map();
  }

  /**
   * Replace the entire map with a new one.
   * @param {Map<any, any>} newMap
   */
  replace(newMap) {
    this._signal.value = newMap;
  }

  /**
   * Apply multiple mutations in a single signal update.
   * @param {(map: Map<any, any>) => void} updater
   */
  batchUpdate(updater) {
    const next = new Map(this._signal.value);
    updater(next);
    this._signal.value = next;
  }

  keys() { return this._signal.value.keys(); }
  values() { return this._signal.value.values(); }
  entries() { return this._signal.value.entries(); }
  forEach(cb, thisArg) { return this._signal.value.forEach(cb, thisArg); }
  [Symbol.iterator]() { return this._signal.value[Symbol.iterator](); }
}
