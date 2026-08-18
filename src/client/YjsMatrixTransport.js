/**
 * YjsMatrixTransport - Matrix-side of the Yjs transport boundary.
 *
 * Sends outbound Yjs binary updates as Matrix timeline events and
 * receives inbound ones for reassembly by `YjsManager`. The 60KB
 * chunk size (`_MAX_CHUNK_SIZE`) sits under Matrix's per-event JSON
 * payload cap of ~64 KB - homeservers reject larger events via
 * `max_event_size` (Synapse default 65536). Yjs binary updates
 * routinely exceed that for rooms with non-trivial maps or character
 * counts, so any update larger than the chunk size is split and
 * tagged with a sequence id so the receiver can rebuild it.
 */

import * as Y from 'yjs';
import { YJS_EVENT_TYPES } from '../state/YjsManager.js';
import { YjsPendingBuffer } from '../state/yjs-pending-buffer.js';
import {
  classifyVectors, electResponder, jitterForUser,
  DIFF_SIZE_CAP_BYTES, REANSWER_DEBOUNCE_MS, PEER_TTL_MS,
} from '../state/yjs-diff-sync.js';
import { isRateLimitError } from '../utils/matrixRetry.js';
import { VTT_EVENTS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

const DRAIN_BASE_MS = 2000;
const DRAIN_MAX_MS = 30000;

// Sync-vector broadcast cadence. An early first broadcast lets peers
// heal a fresh joiner quickly; after that, 60s +/- 15s of jitter keeps
// N clients from beating in step and halves the old 30s timeline
// pollution (each broadcast is a permanent room event).
const SYNC_VECTOR_FIRST_MS = 5000;
const SYNC_VECTOR_INTERVAL_MS = 60000;
const SYNC_VECTOR_JITTER_MS = 15000;
// Coalesce window for outbound local updates. Yjs emits one update per
// transaction (e.g. per token-drag tick); without batching that's one Matrix
// timeline event each - the firehose that buries chat in the sync window and
// risks rate limits. Merging a window's worth into one event via
// Y.mergeUpdates is loss-free (the merged update is equivalent).
const OUTBOUND_COALESCE_MS = 300;

export class YjsMatrixTransport {
  /**
   * @param {import('./MatrixClient').MatrixClient} matrixClient
   * @param {import('../state/YjsManager').YjsManager} yjsManager
   * @param {string} roomId
   */
  constructor(matrixClient, yjsManager, roomId) {
    this.matrixClient = matrixClient;
    this.yjsManager = yjsManager;
    this.roomId = roomId;

    // Per-chunk binary size. After base64 (×1.33) + JSON wrapper +
    // PDU envelope (auth_events, prev_events, hashes, signatures),
    // matrix.org has been observed to reject events well below the
    // 64 KB max_event_size advertised by Synapse defaults - likely
    // because the canonical-JSON form (signed) is larger than the
    // wire form. 24 KB binary → ~32 KB base64 → ~33 KB content →
    // ~35 KB signed PDU, leaving ~29 KB of headroom.
    this._MAX_CHUNK_SIZE = 24000;
    this._sequenceCounter = 0;

    this._pending = new YjsPendingBuffer(roomId);
    this._drainTimer = null;
    this._drainBackoffMs = DRAIN_BASE_MS;
    this._destroyed = false;
    this._onPageHide = () => this._pending.persist();
    window.addEventListener('pagehide', this._onPageHide);

    // Differential sync repair state (see state/yjs-diff-sync.js).
    this._peers = new Map();
    this._answeredVectors = new Map();
    this._diffTimers = new Map();
    this._diffSizeCapBytes = DIFF_SIZE_CAP_BYTES;
    this.onOversizedDiff = null;

    // Outbound coalesce buffer (see OUTBOUND_COALESCE_MS).
    this._coalesceBuffer = [];
    this._coalesceTimer = null;

    this._setup();
  }

  _setup() {
    // 1. Output Path: Yjs -> Matrix. While connected, batch a window of local
    //    updates into one merged event (the token-drag firehose); while
    //    disconnected, buffer per-update for replay on reconnect.
    this.yjsManager.onUpdate((update) => {
      if (this.matrixClient.status === 'connected') {
        this._enqueueOutbound(update);
      } else {
        this._bufferUpdate(update);
      }
    });

    this._unsubStatus = this.matrixClient.onStatusUpdate?.((status) => {
      if (status === 'connected' && !this._pending.isEmpty) {
        this._scheduleDrain(0);
      }
    });

    // 2. Divergence Path: Periodic State Vector Broadcast
    this._startDivergenceCheck();
  }

  _enqueueOutbound(update) {
    this._coalesceBuffer.push(update);
    if (!this._coalesceTimer) {
      this._coalesceTimer = setTimeout(() => this._flushOutbound(), OUTBOUND_COALESCE_MS);
    }
  }

  _flushOutbound() {
    this._coalesceTimer = null;
    if (this._coalesceBuffer.length === 0) return;
    const merged = this._coalesceBuffer.length === 1
      ? this._coalesceBuffer[0]
      : Y.mergeUpdates(this._coalesceBuffer);
    this._coalesceBuffer = [];
    // Decide send-vs-buffer at flush time so a disconnect during the window
    // routes the merged update into the reconnect buffer rather than dropping it.
    if (this.matrixClient.status === 'connected') {
      this._sendChunkedUpdate(merged);
    } else {
      this._bufferUpdate(merged);
    }
  }

  _bufferUpdate(update) {
    this._pending.add(update);
    this._pending.persist();
    window.dispatchEvent(new CustomEvent(VTT_EVENTS.QUEUE_PENDING, {
      detail: { count: this._pending.count, source: 'yjs' },
    }));
  }

  _scheduleDrain(delayMs = this._drainBackoffMs) {
    if (this._destroyed || this._drainTimer) return;
    this._drainTimer = setTimeout(() => {
      this._drainTimer = null;
      this._drainPending();
    }, delayMs);
  }

  async _drainPending() {
    if (this._pending.isEmpty) return;
    if (this.matrixClient.status !== 'connected') return;
    const update = this._pending.takeAll();
    const sent = await this._sendChunkedUpdate(update);
    if (sent) {
      this._drainBackoffMs = DRAIN_BASE_MS;
      this._pending.persist();
      window.dispatchEvent(new CustomEvent(VTT_EVENTS.QUEUE_EMPTY, { detail: { source: 'yjs' } }));
    }
  }

  /**
   * Re-apply updates persisted by a previous page. Must run after the
   * initial snapshot load: YjsManager.loadSnapshot rebuilds the doc and
   * would wipe anything applied earlier. The non-'remote' origin makes
   * YjsManager re-emit the update through onUpdate, so it flows back
   * out through the normal send path.
   */
  restorePersistedPending() {
    const bytes = this._pending.restore();
    if (!bytes) return;
    Y.applyUpdate(this.yjsManager.doc, bytes, 'restored-pending');
  }

  /**
   * Input Path: Matrix -> Yjs
   * Called by MatrixApiAdapter when a Yjs timeline event is received.
   */
  handleIncomingEvent(event) {
    const { type, content } = event;
    
    if (type === YJS_EVENT_TYPES.UPDATE) {
      this.yjsManager.handleMatrixUpdate({
        sequenceId: content.seq,
        index: content.idx,
        total: content.total,
        data: this._base64ToUint8(content.data),
        timestamp: event.origin_server_ts,
      });
    } else if (type === YJS_EVENT_TYPES.SYNC_VECTOR) {
      const vector = this._base64ToUint8(content.vector);
      this.yjsManager.compareStateVector(vector);
      this._handlePeerVector(event.sender, content.vector, vector);
    }
  }

  /**
   * Track peers via their broadcast vectors and, when a peer is missing
   * local data, answer with the exact diff. One deterministic responder
   * plus jitter and a per-peer debounce keep the room from storming.
   */
  _handlePeerVector(sender, vectorB64, vector) {
    if (!sender || sender === this.matrixClient.userId) return;
    const now = Date.now();
    this._peers.set(sender, { vector, seenAt: now });
    for (const [id, peer] of this._peers.entries()) {
      if (now - peer.seenAt > PEER_TTL_MS) this._peers.delete(id);
    }

    const localVector = this.yjsManager.getStateVector();
    if (!classifyVectors(localVector, vector).peerBehind) return;

    const answered = this._answeredVectors.get(sender);
    if (answered && answered.vectorB64 === vectorB64 && now - answered.at < REANSWER_DEBOUNCE_MS) return;

    const responder = electResponder({
      selfId: this.matrixClient.userId,
      localVector,
      peers: this._peers,
      now,
    });
    if (responder !== this.matrixClient.userId) return;

    this._answeredVectors.set(sender, { vectorB64, at: now });
    if (this._diffTimers.has(sender)) return;
    this._diffTimers.set(sender, setTimeout(() => {
      this._diffTimers.delete(sender);
      this._sendDiffFor(vector);
    }, jitterForUser(this.matrixClient.userId)));
  }

  _sendDiffFor(peerVector) {
    // Re-encode at send time: anything that arrived during the jitter
    // window rides along in the same diff.
    const diff = this.yjsManager.encodeDiffSince(peerVector);
    if (!diff || diff.length <= 2) return;
    if (diff.length > this._diffSizeCapBytes) {
      logger.warn('YjsMatrixTransport',
        `diff for lagging peer is ${diff.length} bytes (cap ${this._diffSizeCapBytes}); deferring to snapshot`);
      this.onOversizedDiff?.();
      return;
    }
    this._sendChunkedUpdate(diff);
  }

  async _sendChunkedUpdate(update) {
    const sequenceId = `${this.matrixClient.userId}-${Date.now()}-${this._sequenceCounter++}`;
    const totalChunks = Math.ceil(update.length / this._MAX_CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * this._MAX_CHUNK_SIZE;
      const end = Math.min(start + this._MAX_CHUNK_SIZE, update.length);
      const chunk = update.slice(start, end);

      const content = {
        seq: sequenceId,
        idx: i,
        total: totalChunks,
        data: this._uint8ToBase64(chunk),
      };

      try {
        await this.matrixClient.sendVTTEvent(this.roomId, YJS_EVENT_TYPES.UPDATE, null, content);
      } catch (err) {
        // Abort the remaining chunks: the receiver's partial reassembly
        // ages out, and the retry resends the whole update under a
        // fresh sequence id.
        this._handleSendFailure(update, err, i, totalChunks);
        return false;
      }
    }
    return true;
  }

  _handleSendFailure(update, err, idx, totalChunks) {
    if (!this._isRetriableSend(err)) {
      logger.error('YjsMatrixTransport',
        `dropping update after permanent send failure (chunk ${idx + 1}/${totalChunks})`, err);
      window.dispatchEvent(new CustomEvent(VTT_EVENTS.ERROR, { detail: {
        message: `Could not sync your latest table changes (${err?.errcode || err?.status || 'send failed'}). Other players may not see them.`,
        error: err,
      } }));
      return;
    }

    logger.warn('YjsMatrixTransport',
      `send failed (chunk ${idx + 1}/${totalChunks}); buffering update for retry: ${err?.message || err}`);
    this._bufferUpdate(update);
    if (isRateLimitError(err)) {
      const server = Number(err?.data?.retry_after_ms ?? err?.retry_after_ms);
      const retryAfterMs = Number.isFinite(server) && server > 0 ? server : this._drainBackoffMs;
      window.dispatchEvent(new CustomEvent(VTT_EVENTS.RATE_LIMITED, {
        detail: { retryAfterMs, source: 'yjs' },
      }));
    }
    const delay = this._drainBackoffMs;
    this._drainBackoffMs = Math.min(this._drainBackoffMs * 2, DRAIN_MAX_MS);
    this._scheduleDrain(delay);
  }

  _isRetriableSend(err) {
    if (isRateLimitError(err)) return true;
    const status = err?.httpStatus ?? err?.status;
    if (status == null) return true;
    return status >= 500 && status < 600;
  }

  _startDivergenceCheck() {
    const schedule = (delayMs) => {
      this._divergenceTimer = setTimeout(async () => {
        if (this._destroyed) return;
        if (this.matrixClient.status === 'connected') {
          const content = { vector: this._uint8ToBase64(this.yjsManager.getStateVector()) };
          try {
            await this.matrixClient.sendVTTEvent(this.roomId, YJS_EVENT_TYPES.SYNC_VECTOR, null, content);
          } catch (err) {
            logger.error('YjsMatrixTransport', 'Failed to send sync vector', err);
          }
        }
        const jitter = (Math.random() * 2 - 1) * SYNC_VECTOR_JITTER_MS;
        schedule(SYNC_VECTOR_INTERVAL_MS + jitter);
      }, delayMs);
    };
    schedule(SYNC_VECTOR_FIRST_MS);
  }

  _uint8ToBase64(arr) {
    return btoa(String.fromCharCode.apply(null, arr));
  }

  _base64ToUint8(str) {
    return new Uint8Array(atob(str).split('').map(c => c.charCodeAt(0)));
  }

  destroy() {
    this._destroyed = true;
    clearTimeout(this._divergenceTimer);
    if (this._coalesceTimer) {
      clearTimeout(this._coalesceTimer);
      this._coalesceTimer = null;
    }
    if (this._drainTimer) {
      clearTimeout(this._drainTimer);
      this._drainTimer = null;
    }
    for (const timer of this._diffTimers.values()) clearTimeout(timer);
    this._diffTimers.clear();
    // Best-effort final flush so the last edit isn't stranded in the buffer.
    this._flushOutbound();
    this._pending.persist();
    window.removeEventListener('pagehide', this._onPageHide);
    this._unsubStatus?.();
  }
}
