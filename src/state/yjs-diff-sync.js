/**
 * Pure helpers for differential sync repair. When a peer's broadcast
 * sync_vector shows it is missing local data, one client answers with
 * Y.encodeStateAsUpdate(doc, peerVector). These helpers decide who:
 * a deterministic election (lowest userId among caught-up peers) plus
 * per-user jitter keeps N clients from all answering at once.
 * Duplicate answers are harmless (Y.applyUpdate is idempotent), so the
 * election only needs to make storms rare, not impossible.
 */

import * as Y from 'yjs';

export const DIFF_SIZE_CAP_BYTES = 512 * 1024;
export const REANSWER_DEBOUNCE_MS = 60_000;
// Roster entries older than 3 broadcast intervals are treated as offline.
export const PEER_TTL_MS = 3 * 60_000;

/**
 * Compare a peer's state vector against the local one.
 * peerBehind: the peer is missing operations the local doc has.
 * peerAhead: the peer has operations the local doc is missing.
 * @param {Uint8Array} localVector
 * @param {Uint8Array} remoteVector
 */
export function classifyVectors(localVector, remoteVector) {
  const local = Y.decodeStateVector(localVector);
  const remote = Y.decodeStateVector(remoteVector);

  let peerBehind = false;
  let peerAhead = false;
  for (const [client, clock] of local.entries()) {
    if ((remote.get(client) ?? 0) < clock) peerBehind = true;
  }
  for (const [client, clock] of remote.entries()) {
    if ((local.get(client) ?? 0) < clock) peerAhead = true;
  }
  return { peerBehind, peerAhead };
}

/**
 * Deterministically pick the responder for a lagging peer: the lowest
 * userId among fresh peers that are not behind the local doc, with the
 * local user always a candidate.
 * @param {{selfId: string, localVector: Uint8Array,
 *          peers: Map<string, {vector: Uint8Array, seenAt: number}>,
 *          now?: number}} args
 */
export function electResponder({ selfId, localVector, peers, now = Date.now() }) {
  const candidates = [selfId];
  for (const [id, peer] of peers.entries()) {
    if (now - peer.seenAt > PEER_TTL_MS) continue;
    if (!classifyVectors(localVector, peer.vector).peerBehind) candidates.push(id);
  }
  candidates.sort();
  return candidates[0];
}

/** Deterministic per-user delay in [minMs, maxMs) to de-correlate answers. */
export function jitterForUser(userId, minMs = 200, maxMs = 800) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return minMs + (h % (maxMs - minMs));
}
