/**
 * snapshot-chunks.js - pure helpers for splitting a Yjs snapshot
 * binary into Matrix-state-event-sized chunks and reassembling them.
 *
 * Matrix's per-event JSON cap (matrix.org: 65 536 bytes) means a
 * mid-size campaign's `Y.encodeStateAsUpdate` output (≥48 KB binary
 * → ≥64 KB base64) can't fit in one state event. We publish multiple
 * state events, keyed by `(marker, idx)`, and reassemble on load.
 *
 * Encoding:
 *   - state_key: `${marker}-${idx}`  (legacy publishes used `""`)
 *   - content:   { data: base64, marker: int, idx: int, total: int }
 *
 * The loader is backwards-compatible: a legacy single-event snapshot
 * has no idx/total and is treated as `{ idx: 0, total: 1 }`.
 *
 * Functions here do NO Yjs / Matrix I/O - pure data transforms so
 * they're trivially unit-testable.
 */

/** Default per-chunk binary size. 24 KB → ≈32 KB base64 → ≈35 KB
 *  signed-PDU. matrix.org rejected 32 KB binary chunks in practice
 *  even though they wire-encoded to ~44 KB; the signed canonical-JSON
 *  form is larger. Matches `_MAX_CHUNK_SIZE` in YjsMatrixTransport. */
export const SNAPSHOT_CHUNK_BYTES = 24 * 1024;

/**
 * Split a binary buffer into N pieces of at most `maxBytes` bytes.
 * Always returns at least one chunk (even for empty input).
 *
 * @param {Uint8Array} bytes
 * @param {number} [maxBytes]
 * @returns {Uint8Array[]}
 */
export function splitBinaryToChunks(bytes, maxBytes = SNAPSHOT_CHUNK_BYTES) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('splitBinaryToChunks: bytes must be Uint8Array');
  }
  if (maxBytes <= 0) throw new RangeError('maxBytes must be > 0');
  if (bytes.length === 0) return [new Uint8Array(0)];
  const out = [];
  for (let start = 0; start < bytes.length; start += maxBytes) {
    out.push(bytes.subarray(start, Math.min(start + maxBytes, bytes.length)));
  }
  return out;
}

/**
 * Concatenate chunks (in index order - caller's responsibility to sort).
 * @param {Uint8Array[]} chunks
 * @returns {Uint8Array}
 */
export function joinChunks(chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

/**
 * Pick the latest *complete* snapshot from a flat list of state events.
 * Events are grouped by `marker`; a group is "complete" when chunks
 * 0..total-1 are all present. Highest complete marker wins. Legacy
 * events with no idx/total are treated as { idx: 0, total: 1 }.
 *
 * @param {Array<{ content?: { data?: string, marker?: number, idx?: number, total?: number } }>} events
 * @returns {{ marker: number, chunks: Array<{idx: number, data: string}> } | null}
 *   `null` when no complete snapshot exists.
 */
export function chooseLatestCompleteSnapshot(events) {
  if (!Array.isArray(events) || events.length === 0) return null;

  /** @type {Map<number, Map<number, { data: string, total: number }>>} */
  const byMarker = new Map();

  for (const e of events) {
    const c = e?.content;
    if (!c || typeof c.data !== 'string' || typeof c.marker !== 'number') continue;
    const idx   = Number.isInteger(c.idx)   ? c.idx   : 0;
    const total = Number.isInteger(c.total) && c.total > 0 ? c.total : 1;
    if (idx < 0 || idx >= total) continue;
    let group = byMarker.get(c.marker);
    if (!group) { group = new Map(); byMarker.set(c.marker, group); }
    // Last-write-wins on duplicate (marker, idx) pairs.
    group.set(idx, { data: c.data, total });
  }

  // Iterate markers from highest to lowest; return the first complete one.
  const markers = [...byMarker.keys()].sort((a, b) => b - a);
  for (const marker of markers) {
    const group = byMarker.get(marker);
    // Every chunk in the group should declare the same total; trust the
    // first one. (A future writer that disagrees is malformed; skip.)
    const first = group.values().next().value;
    if (!first) continue;
    const total = first.total;
    if (group.size < total) continue;
    let complete = true;
    /** @type {Array<{idx: number, data: string}>} */
    const chunks = [];
    for (let i = 0; i < total; i++) {
      const c = group.get(i);
      if (!c) { complete = false; break; }
      chunks.push({ idx: i, data: c.data });
    }
    if (complete) return { marker, chunks };
  }
  return null;
}

/**
 * Convert a base64 string to a Uint8Array. Helper because the snapshot
 * loader and the chunker both need it and we don't want to depend on
 * Buffer or a polyfill.
 *
 * @param {string} s
 * @returns {Uint8Array}
 */
export function base64ToBytes(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Convert a Uint8Array to base64. Uses `String.fromCharCode.apply` in
 * batches because spreading a >100 KB array blows the call-stack limit.
 *
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToBase64(bytes) {
  const CHUNK = 0x8000;
  let result = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const sub = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    result += String.fromCharCode.apply(null, /** @type {any} */ (Array.from(sub)));
  }
  return btoa(result);
}
