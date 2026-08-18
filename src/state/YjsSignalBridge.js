/**
 * YjsSignalBridge - mirrors a Y.Map or Y.Array onto granular Preact
 * signals so a single-entity update (e.g. one token moving) fans out
 * to exactly the subscribers of that entity instead of to anything
 * reading the whole collection.
 *
 * Naive approach would be `signal.value = yMap.toJSON()` on every
 * Yjs event - that serializes the entire doc on each tick and any
 * effect reading the collection re-runs, causing UI-wide jank when
 * dragging tokens. This bridge keeps a per-entity signal map; adds /
 * deletes update an `ids` signal, mutations only touch the entity's
 * own signal. All observations run inside `batch()` so a multi-key
 * Yjs transaction is delivered as one Preact render tick.
 */

import { signal, batch } from '@preact/signals';

export class YjsSignalBridge {
  /**
   * @param {any} yCollection - a Y.Map or Y.Array
   * @param {'map'|'array'} [type]
   */
  constructor(yCollection, type = 'map') {
    this.yCollection = yCollection;
    this.type = type;

    // Signal for the list of IDs (keys for Map, indices or IDs for Array)
    // For VTT, drawings in Y.Array should probably have internal IDs too.
    this.ids = signal(this._getCurrentIds());

    // Registry of granular signals: Map<id, signal<data>>
    this._signals = new Map();

    this._init();
  }

  _init() {
    // Bind once so rebind() can unobserve the same handler reference.
    this._boundObserveMap = (e) => this._observeMap(e);
    this._boundObserveArray = () => this._observeArray();
    if (this.type === 'map') {
      for (const [key, data] of this.yCollection.entries()) {
        this._signals.set(key, signal(data));
      }
      this.yCollection.observe(this._boundObserveMap);
    } else {
      // For Y.Array (drawings), we treat the whole array as one reactive unit
      // for now, but we could make it granular if drawings become editable.
      this._signals.set('root', signal(this.yCollection.toArray()));
      this.yCollection.observe(this._boundObserveArray);
    }
  }

  /**
   * Re-target this bridge at a new Y.Map / Y.Array on a fresh Y.Doc
   * (e.g. after YjsManager.loadSnapshot replaces the underlying doc).
   * Preserves the `ids` signal identity so subscribers bound before the
   * rebind keep firing without re-subscribing.
   */
  rebind(newCollection) {
    const handler = this.type === 'map' ? this._boundObserveMap : this._boundObserveArray;
    try { this.yCollection.unobserve(handler); } catch { /* unbinding may throw if doc was destroyed */ }
    this.yCollection = newCollection;
    this._signals.clear();
    if (this.type === 'map') {
      for (const [key, data] of newCollection.entries()) {
        this._signals.set(key, signal(data));
      }
      newCollection.observe(this._boundObserveMap);
    } else {
      this._signals.set('root', signal(newCollection.toArray()));
      newCollection.observe(this._boundObserveArray);
    }
    this.ids.value = this._getCurrentIds();
  }

  _getCurrentIds() {
    if (this.type === 'map') {
      return Array.from(this.yCollection.keys());
    }
    // For Y.Array, we don't have stable keys by default.
    // In MatrixVTT, drawings are often indexed by their order.
    return Array.from({ length: this.yCollection.length }, (_, i) => i);
  }

  _observeMap(event) {
    batch(() => {
      let idsChanged = false;
      event.changes.keys.forEach((change, key) => {
        if (change.action === 'add') {
          const data = this.yCollection.get(key);
          this._signals.set(key, signal(data));
          idsChanged = true;
        } else if (change.action === 'update') {
          const sig = this._signals.get(key);
          if (sig) {
            sig.value = this.yCollection.get(key);
          }
        } else if (change.action === 'delete') {
          this._signals.delete(key);
          idsChanged = true;
        }
      });

      if (idsChanged) {
        this.ids.value = this._getCurrentIds();
      }
    });
  }

  _observeArray() {
    // Basic array bridging: update the 'root' signal
    const sig = this._signals.get('root');
    if (sig) {
      sig.value = this.yCollection.toArray();
    }
    this.ids.value = this._getCurrentIds();
  }

  /**
   * Get the signal for a specific entity.
   * @param {string} id
   * @returns {import('@preact/signals').Signal}
   */
  get(id) {
    return this._signals.get(id);
  }

  /**
   * Get all signals as a Map.
   */
  getAll() {
    return this._signals;
  }
}

/**
 * FrameBatcher - throttles callbacks to requestAnimationFrame.
 * Essential for the Konva MapRenderer to avoid main-thread saturation.
 */
export class FrameBatcher {
  constructor(callback) {
    this.callback = callback;
    this._pending = false;
  }

  request() {
    if (this._pending) return;
    this._pending = true;
    requestAnimationFrame(() => {
      this._pending = false;
      this.callback();
    });
  }
}
