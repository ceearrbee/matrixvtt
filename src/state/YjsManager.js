/**
 * YjsManager - owns the Yjs Y.Doc that backs the VTT's high-frequency
 * collaborative state (tokens, characters, items, etc., one Y.Map per
 * collection) and the snapshot publish path.
 *
 * Inbound updates arrive as Matrix timeline events. They're split into
 * 60KB chunks on the sender side (`YjsMatrixTransport`) because Matrix
 * homeservers cap per-event JSON payload near 64 KB (`max_event_size`,
 * default 65536) and Yjs binary updates routinely exceed that for
 * non-trivial rooms. This module reassembles those chunks before
 * applying via `Y.applyUpdate`. Incomplete reassembly buffers age out
 * after `_CHUNKING_TIMEOUT_MS`; CRDT convergence recovers from the
 * loss on the next full snapshot or peer rebroadcast.
 *
 * Outbound bridge to UI: a `YjsSignalBridge` per collection mirrors
 * Y.Map deltas to per-entity Preact signals so changes fan out at
 * entity granularity instead of doc-wide.
 */

import * as Y from 'yjs';
import { Subject } from 'rxjs';
import { YjsSignalBridge } from './YjsSignalBridge.js';
import { logger } from '../utils/logger.js';

export { YJS_EVENT_TYPES } from '../utils/constants.js';

// The snapshot marker is the publisher's wall clock (Date.now()); incoming
// update timestamps are homeserver origin_server_ts. Cross-clock comparison
// means clock skew between the GM's machine and the homeserver could drop a
// real post-snapshot update. Re-applying a slightly-pre-marker update is
// harmless (the CRDT is idempotent), so we keep a grace window before the
// cutoff drops anything.
const SNAPSHOT_CUTOFF_GRACE_MS = 30000;

export class YjsManager {
  constructor(roomId) {
    this.roomId = roomId;
    this.doc = new Y.Doc();

    // 1. Core Collections (Private Yjs types)
    // Keyed entity types (Y.Map):
    this.tokensMap     = this.doc.getMap('tokens');
    this.charactersMap = this.doc.getMap('characters');
    this.npcsMap       = this.doc.getMap('npcs');
    this.itemsMap      = this.doc.getMap('items');
    this.spellsMap     = this.doc.getMap('spells');
    this.handoutsMap   = this.doc.getMap('handouts');
    this.tablesMap     = this.doc.getMap('tables');
    this.wallsMap      = this.doc.getMap('walls');
    this.lightsMap     = this.doc.getMap('lights');
    this.pinsMap       = this.doc.getMap('pins');
    this.templatesMap  = this.doc.getMap('templates');
    this.mapsMap       = this.doc.getMap('maps');
    this.pagesMap      = this.doc.getMap('pages');
    // Singleton-shaped types use Y.Map keyed by '' so bridge('map') reuses.
    this.fogMap        = this.doc.getMap('fog');
    this.initiativeMap = this.doc.getMap('initiative');
    this.settingsMap   = this.doc.getMap('settings');
    // Drawings is the only Y.Array - append-friendly stroke history.
    this.drawingsArray = this.doc.getArray('drawings');

    // 2. Reactive bridges: one granular signal per collection.
    this.tokens     = new YjsSignalBridge(this.tokensMap, 'map');
    this.characters = new YjsSignalBridge(this.charactersMap, 'map');
    this.npcs       = new YjsSignalBridge(this.npcsMap, 'map');
    this.items      = new YjsSignalBridge(this.itemsMap, 'map');
    this.spells     = new YjsSignalBridge(this.spellsMap, 'map');
    this.handouts   = new YjsSignalBridge(this.handoutsMap, 'map');
    this.tables     = new YjsSignalBridge(this.tablesMap, 'map');
    this.walls      = new YjsSignalBridge(this.wallsMap, 'map');
    this.lights     = new YjsSignalBridge(this.lightsMap, 'map');
    this.pins       = new YjsSignalBridge(this.pinsMap, 'map');
    this.templates  = new YjsSignalBridge(this.templatesMap, 'map');
    this.maps       = new YjsSignalBridge(this.mapsMap, 'map');
    this.pages      = new YjsSignalBridge(this.pagesMap, 'map');
    this.fog        = new YjsSignalBridge(this.fogMap, 'map');
    this.initiative = new YjsSignalBridge(this.initiativeMap, 'map');
    this.settings   = new YjsSignalBridge(this.settingsMap, 'map');
    this.drawings   = new YjsSignalBridge(this.drawingsArray, 'array');

    // Transport abstraction boundary
    this._onUpdateCallback = null;
    this._onDivergenceCallback = null;

    // Buffer for chunked update reassembly
    // Key: sequenceId -> { chunks: Map(idx -> data), total: N, timestamp: Date }
    this._reassemblyBuffers = new Map();
    this._CHUNKING_TIMEOUT_MS = 30000;
    this._MAX_BUFFER_SIZE = 100; // updates in reassembly

    this._snapshotBaselineVector = null; // Uint8Array
    this._snapshotMarker = 0; // Authoritative logical cutoff

    // Reactivity: Subjects for Preact Signals to consume
    this.updates$ = new Subject();

    this._setupObservers();
    this._startCleanupInterval();
  }

  _setupObservers() {
    this.doc.on('update', (update, origin) => {
      // Prevent loops: only emit local updates to transport
      if (origin !== 'remote' && this._onUpdateCallback) {
        this._onUpdateCallback(update);
      }
      this.updates$.next({ update, origin });
    });
  }

  /**
   * Transport Boundary: Entry point for updates from Matrix.
   */
  handleMatrixUpdate(payload) {
    const { sequenceId, index, total, data, timestamp } = payload;

    // 1. Snapshot Cutoff Check: The Yjs state vector is authoritative,
    // but the timestamp check is a vital optimization to avoid buffering
    // thousands of pre-snapshot timeline events.
    if (this._snapshotMarker > 0 && timestamp < this._snapshotMarker - SNAPSHOT_CUTOFF_GRACE_MS) {
      return;
    }

    // 2. Reassembly Logic
    let buffer = this._reassemblyBuffers.get(sequenceId);
    if (!buffer) {
      if (this._reassemblyBuffers.size >= this._MAX_BUFFER_SIZE) {
        this._evictOldestBuffer();
      }
      buffer = { chunks: new Map(), total, timestamp: Date.now() };
      this._reassemblyBuffers.set(sequenceId, buffer);
    }

    buffer.chunks.set(index, new Uint8Array(data));

    if (buffer.chunks.size === buffer.total) {
      const fullUpdate = this._reassemble(buffer);
      this._reassemblyBuffers.delete(sequenceId);
      this._applyValidatedUpdate(fullUpdate);
    }
  }

  /**
   * Apply a fully reassembled binary update to the Yjs Doc.
   */
  _applyValidatedUpdate(update) {
    try {
      Y.applyUpdate(this.doc, update, 'remote');
    } catch (err) {
      logger.error('YjsManager', 'Failed to apply update', err);
    }
  }

  _reassemble(buffer) {
    const sortedIndices = Array.from(buffer.chunks.keys()).sort((a, b) => a - b);
    const totalLength = Array.from(buffer.chunks.values()).reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const idx of sortedIndices) {
      result.set(buffer.chunks.get(idx), offset);
      offset += buffer.chunks.get(idx).length;
    }
    return result;
  }

  loadSnapshot(snapshotData, marker) {
    this._snapshotMarker = marker;
    this._snapshotBaselineVector = Y.encodeStateVectorFromUpdate(snapshotData);

    // 1. Absolute Authoritative Override: Destroy the old doc and start fresh.
    // This ensures no history or state leaks from the previous session.
    this.doc.destroy();
    this.doc = new Y.Doc();

    // Re-initialize collections on the new doc.
    this.tokensMap     = this.doc.getMap('tokens');
    this.charactersMap = this.doc.getMap('characters');
    this.npcsMap       = this.doc.getMap('npcs');
    this.itemsMap      = this.doc.getMap('items');
    this.spellsMap     = this.doc.getMap('spells');
    this.handoutsMap   = this.doc.getMap('handouts');
    this.tablesMap     = this.doc.getMap('tables');
    this.wallsMap      = this.doc.getMap('walls');
    this.lightsMap     = this.doc.getMap('lights');
    this.pinsMap       = this.doc.getMap('pins');
    this.templatesMap  = this.doc.getMap('templates');
    this.mapsMap       = this.doc.getMap('maps');
    this.pagesMap      = this.doc.getMap('pages');
    this.fogMap        = this.doc.getMap('fog');
    this.initiativeMap = this.doc.getMap('initiative');
    this.settingsMap   = this.doc.getMap('settings');
    this.drawingsArray = this.doc.getArray('drawings');

    // Re-target bridges in place - same Signal objects, new doc behind them.
    this.tokens.rebind(this.tokensMap);
    this.characters.rebind(this.charactersMap);
    this.npcs.rebind(this.npcsMap);
    this.items.rebind(this.itemsMap);
    this.spells.rebind(this.spellsMap);
    this.handouts.rebind(this.handoutsMap);
    this.tables.rebind(this.tablesMap);
    this.walls.rebind(this.wallsMap);
    this.lights.rebind(this.lightsMap);
    this.pins.rebind(this.pinsMap);
    this.templates.rebind(this.templatesMap);
    this.maps.rebind(this.mapsMap);
    this.pages.rebind(this.pagesMap);
    this.fog.rebind(this.fogMap);
    this.initiative.rebind(this.initiativeMap);
    this.settings.rebind(this.settingsMap);
    this.drawings.rebind(this.drawingsArray);

    // Re-setup observers for the new doc.
    this._setupObservers();

    // 2. Apply Snapshot.
    Y.applyUpdate(this.doc, snapshotData, 'snapshot');

    // Clear buffers that are now stale (pre-snapshot).
    this._reassemblyBuffers.clear();
  }

  /**
   * Divergence Detection.
   */
  getStateVector() {
    return Y.encodeStateVector(this.doc);
  }

  compareStateVector(remoteVector) {
    // "Behind" (local clock is less than remote clock for a given
    // client id) is *not* divergence - it's normal sync lag, and the
    // Yjs CRDT converges naturally once the missing UPDATE chunks
    // arrive over the timeline. True divergence is a **fork**: we have
    // updates the remote doesn't AND we're missing updates the remote
    // has. Only that case warrants firing the recovery callback.
    //
    // Flagging plain lag as divergence would toast every user each
    // time a peer joined and broadcast its initial vector (or after
    // any brief network blip).
    const localVector = Y.encodeStateVector(this.doc);
    const local = Y.decodeStateVector(localVector);
    const remote = Y.decodeStateVector(remoteVector);

    let weAreBehind = false;
    let weAreAhead = false;
    for (const [client, clock] of remote.entries()) {
      const localClock = local.get(client) ?? 0;
      if (localClock < clock) { weAreBehind = true; }
    }
    for (const [client, clock] of local.entries()) {
      const remoteClock = remote.get(client) ?? 0;
      if (remoteClock < clock) { weAreAhead = true; }
    }

    // True divergence: forked history. Pure lag (behind only) is
    // expected and self-correcting. Pure ahead (peer is catching up
    // to us) is also fine.
    const forked = weAreBehind && weAreAhead;
    if (forked) {
      if (this._onDivergenceCallback) this._onDivergenceCallback();
      console.warn('[YjsManager] Forked state detected via remote vector comparison.');
    }
    return { behind: weAreBehind, ahead: weAreAhead, forked };
  }

  /** Encode exactly the operations a peer at `remoteVector` is missing. */
  encodeDiffSince(remoteVector) {
    return Y.encodeStateAsUpdate(this.doc, remoteVector);
  }

  onDivergence(callback) {
    this._onDivergenceCallback = callback;
  }

  /**
   * Transport Boundary: Output registration.
   */
  onUpdate(callback) {
    this._onUpdateCallback = callback;
  }

  _evictOldestBuffer() {
    let oldestKey = null;
    let oldestTs = Infinity;
    for (const [key, buffer] of this._reassemblyBuffers.entries()) {
      if (buffer.timestamp < oldestTs) {
        oldestTs = buffer.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) this._reassemblyBuffers.delete(oldestKey);
  }

  _startCleanupInterval() {
    this._cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, buffer] of this._reassemblyBuffers.entries()) {
        if (now - buffer.timestamp > this._CHUNKING_TIMEOUT_MS) {
          this._reassemblyBuffers.delete(key);
        }
      }
    }, 10000);
  }

  destroy() {
    clearInterval(this._cleanupInterval);
    this.doc.destroy();
    this.updates$.complete();
  }
}
