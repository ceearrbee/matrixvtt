/**
 * Outgoing Matrix writes + rate-limit retry queue.
 *
 * `sendStateEvent` dedups identical content, enforces the 64 KB cap, and on
 * HTTP 429 parks the write in an in-memory queue that drains every 2s.
 * `flushQueueToStorage` / `restoreQueueFromStorage` survive page unloads.
 */

import { stateEventsEqual, validateStateEvent } from '../utils/schemas.js';
import { VTTError, ErrorType } from '../utils/errorHandling.js';
import { EVENT_TYPES, STORAGE_KEYS, VTT_EVENTS } from '../utils/constants.js';
import { canSendEventType } from './reader.js';
import { stripSystemConfigForWrite } from './settings-marshal.js';

const MAX_EVENT_BYTES = 63000;
const DRAIN_DELAY_MS = 2000;

export async function sendStateEvent(sm, type, stateKey, content) {
  if (type === EVENT_TYPES.SETTINGS && content) {
    content = stripSystemConfigForWrite(content);
  }
  // Per-event-type power-level enforcement (ROADMAP 2.7/2.8). When the
  // room's power_levels event has been ingested and the local user lacks
  // sufficient power for `type`, refuse the write rather than queuing a
  // guaranteed-403 send. The homeserver remains authoritative; this is
  // an immediate-feedback shortcut and a defence against queue bloat.
  if (!canSendEventType(sm, type)) {
    throw new VTTError(
      ErrorType.PERMISSION,
      `You do not have permission to send ${type} events in this room.`
    );
  }
  const cacheKey = `${type}:${stateKey}`;
  if (stateEventsEqual(sm.lastSentState?.get(cacheKey), content)) {
    return;
  }

  const byteLen = new TextEncoder().encode(JSON.stringify(content)).length;
  if (byteLen > MAX_EVENT_BYTES) {
    throw new VTTError(
      ErrorType.STATE_WRITE,
      `State event too large (${(byteLen / 1024).toFixed(1)} KB)`
    );
  }

  // Outbound validation - same schemas the syncer runs on incoming events.
  // Validate outbound too: without this, a UI bug can push genuinely
  // invalid state to the server, and every client that later syncs it
  // silently drops it. Tombstones (empty content) always pass through -
  // validateStateEvent short-circuits on `{}`.
  try {
    validateStateEvent(type, content, sm.settings?.systemConfig);
  } catch (err) {
    throw new VTTError(ErrorType.VALIDATION, err?.message || `Invalid ${type} payload`, err);
  }

  try {
    const res = await sm.widgetManager.sendStateEvent(type, stateKey, content);
    sm.lastSentState?.set(cacheKey, structuredClone(content));
    return res;
  } catch (e) {
    if (_isRetriable(e)) enqueue(sm, type, stateKey, content, cacheKey);
    else throw e;
  }
}

function _isRetriable(err) {
  // matrix-js-sdk's MatrixError exposes the HTTP status as `httpStatus`,
  // not `status` - a fetch-flavoured wrapper would set `status`. Check
  // both shapes so a wrapped or unwrapped error doesn't silently
  // demote a 429/5xx to fatal: a chunked snapshot publish that hits a
  // 429 on a later chunk must park the chunk in the retry queue, not
  // throw at the call site.
  const status = err?.httpStatus ?? err?.status;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

// Room events are append-only (no stateKey dedup) and their order can
// matter (chat messages, audit events), so each queue entry is unique
// and we preserve insertion order in the existing Map.
let _roomEventSeq = 0;

export async function sendRoomEvent(sm, type, content) {
  if (!canSendEventType(sm, type)) {
    throw new VTTError(
      ErrorType.PERMISSION,
      `You do not have permission to send ${type} events in this room.`
    );
  }
  const byteLen = new TextEncoder().encode(JSON.stringify(content ?? {})).length;
  if (byteLen > MAX_EVENT_BYTES) {
    throw new VTTError(
      ErrorType.STATE_WRITE,
      `Room event too large (${(byteLen / 1024).toFixed(1)} KB)`
    );
  }
  try {
    return await sm.widgetManager.sendRoomEvent(type, content);
  } catch (e) {
    if (_isRetriable(e)) {
      _enqueueRoomEvent(sm, type, content);
      return;
    }
    throw e;
  }
}

function _enqueueRoomEvent(sm, type, content) {
  const cacheKey = `room:${type}:${++_roomEventSeq}`;
  sm._retryQueue.set(cacheKey, { kind: 'room', type, content });
  scheduleDrain(sm);
}

function enqueue(sm, type, stateKey, content, cacheKey) {
  sm.lastSentState?.set(cacheKey, structuredClone(content));
  sm._retryQueue.set(cacheKey, { type, stateKey, content });
  scheduleDrain(sm);
}

function scheduleDrain(sm) {
  if (sm._drainTimer) return;
  sm._drainTimer = setTimeout(async () => {
    sm._drainTimer = null;
    await drainRetryQueue(sm);
  }, DRAIN_DELAY_MS);
}

function _emitQueuePending(sm) {
  window.dispatchEvent(new CustomEvent(VTT_EVENTS.QUEUE_PENDING, {
    detail: { count: sm._retryQueue.size, source: 'matrix' },
  }));
}

export async function drainRetryQueue(sm) {
  if (sm._retryQueue.size === 0) {
    window.dispatchEvent(new CustomEvent(VTT_EVENTS.QUEUE_EMPTY, { detail: { source: 'matrix' } }));
    return;
  }

  for (const [key, item] of sm._retryQueue) {
    const wait = sm.widgetManager?.getRateLimitWait?.() ?? 0;
    if (wait > 0) {
      _emitQueuePending(sm);
      window.dispatchEvent(new CustomEvent(VTT_EVENTS.RATE_LIMITED, {
        detail: { retryAfterMs: wait, source: 'matrix' },
      }));
      scheduleDrain(sm);
      return;
    }
    try {
      if (item.kind === 'room') {
        await sm.widgetManager.sendRoomEvent(item.type, item.content);
      } else {
        await sm.widgetManager.sendStateEvent(item.type, item.stateKey, item.content);
      }
      sm._retryQueue.delete(key);
    } catch (e) {
      if (_isRetriable(e)) {
        // 429 or 5xx - keep the item queued, back off and try again.
        _emitQueuePending(sm);
        scheduleDrain(sm);
        break;
      }
      // Permanent failure (403/404/400/…). Drop the queued item so the
      // drain loop doesn't stall forever on a write the homeserver will
      // never accept, but surface the error so the user knows what
      // didn't land - silent deletion is how tombstones mysteriously
      // fail to stick.
      const label = item.kind === 'room' ? item.type : `${item.type}#${item.stateKey}`;
      window.dispatchEvent(new CustomEvent(VTT_EVENTS.ERROR, { detail: {
        message: `Dropping ${label} from retry queue: ${e?.message || 'unknown error'} (${e?.errcode || e?.status || 'no code'})`,
        error: e,
      } }));
      sm._retryQueue.delete(key);
    }
  }

  if (sm._retryQueue.size === 0) {
    window.dispatchEvent(new CustomEvent(VTT_EVENTS.QUEUE_EMPTY, { detail: { source: 'matrix' } }));
  }
}

/**
 * Resolve once the retry queue is empty, or after `timeoutMs` elapses.
 * Used by deleteSession/bootstrap to avoid tearing down the client while
 * 429-parked tombstones are still pending - those writes would otherwise be
 * lost and the "deleted" room would still contain live state events on rejoin.
 */
export function awaitQueueDrain(sm, timeoutMs = 15000) {
  return new Promise((resolve) => {
    if (!sm || sm._retryQueue.size === 0) { resolve('empty'); return; }

    let timer = null;
    const cleanup = () => {
      window.removeEventListener(VTT_EVENTS.QUEUE_EMPTY, onEmpty);
      if (timer) { clearTimeout(timer); timer = null; }
    };
    // The Yjs pending buffer emits the same event with source 'yjs';
    // only resolve once this manager's own queue is actually empty.
    const onEmpty = () => {
      if (sm._retryQueue.size > 0) return;
      cleanup();
      resolve('drained');
    };
    window.addEventListener(VTT_EVENTS.QUEUE_EMPTY, onEmpty);
    scheduleDrain(sm); // ensure a drain attempt is pending
    timer = setTimeout(() => { cleanup(); resolve('timeout'); }, timeoutMs);
  });
}

export function flushQueueToStorage(sm) {
  const entries = Array.from(sm._retryQueue.entries()).map(([cacheKey, item]) => ({
    ...item,
    cacheKey,
  }));
  sessionStorage.setItem(STORAGE_KEYS.RETRY_QUEUE, JSON.stringify(entries));
}

export function restoreQueueFromStorage(sm) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.RETRY_QUEUE);
    if (raw) {
      JSON.parse(raw).forEach((i) => sm._retryQueue.set(i.cacheKey, i));
      if (sm._retryQueue.size > 0) scheduleDrain(sm);
    }
    sessionStorage.removeItem(STORAGE_KEYS.RETRY_QUEUE);
  } catch (_e) {
    // sessionStorage may be unavailable in some test environments.
  }
}

export function isRateLimited(sm) {
  return sm._retryQueue.size > 0;
}
