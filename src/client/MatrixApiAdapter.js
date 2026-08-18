/**
 * MatrixApiAdapter
 * Bridges matrix-js-sdk events to RxJS Subjects for StateManager.
 */

import { Subject } from 'rxjs';
import { EventTimeline, Filter } from 'matrix-js-sdk';
import { VTT_EVENTS, EVENT_TYPES } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import { YjsMatrixTransport } from './YjsMatrixTransport.js';
import { YJS_EVENT_TYPES } from '../state/YjsManager.js';

export class MatrixApiAdapter {
  constructor(matrixClient, roomId, yjsManager = null) {
    this._matrixClient = matrixClient; // The refactored MatrixClient wrapper
    this._roomId = roomId;

    this.widgetParameters = { roomId };
    this._subjects = new Map();

    this._initialSyncDone = false;
    this._syncErrored = false;
    this._consecutiveFailures = 0;
    this._stateCachePromise = null;
    this.hasMoreHistory = true;
    this.hasMoreChatHistory = true;
    this._chatToken = null;
    this._stopped = false;

    this._yjsTransport = yjsManager ? new YjsMatrixTransport(matrixClient, yjsManager, roomId) : null;

    this._setupEventListeners();
  }

  _attachYjs(yjsManager) {
    if (this._yjsTransport || !yjsManager) return;
    this._yjsTransport = new YjsMatrixTransport(this._matrixClient, yjsManager, this._roomId);
  }

  _setupEventListeners() {
    const sdk = this._matrixClient.sdk;
    if (!sdk) return;
    // Keep refs to the sdk + bound handlers so stopSync() can deregister
    // them - otherwise switching rooms / re-initing against a reused sdk
    // leaks listeners that keep firing (and double-process events).
    this._sdk = sdk;
    this._handlers = {};

    // Listen for state events
    this._handlers.roomStateEvents = (event, _state) => {
      if (event.getRoomId() !== this._roomId) return;
      this._forwardStateEvent(event);
    };
    sdk.on('RoomState.events', this._handlers.roomStateEvents);

    this._handlers.roomTimeline = (event, room, toStartOfTimeline) => {
      if (room.roomId !== this._roomId) return;

      const type = event.getType();

      // Route Yjs events directly to transport
      if (this._yjsTransport && (type === YJS_EVENT_TYPES.UPDATE || type === YJS_EVENT_TYPES.SYNC_VECTOR)) {
        // Strictly ignore redactions for Yjs transport events.
        if (event.isRedacted()) {
          logger.warn('MatrixApiAdapter', 'Ignoring redacted Yjs transport event');
          return;
        }
        this._yjsTransport.handleIncomingEvent(this._mapEvent(event));
        return;
      }

      if (event.isState()) {
        // State events are LWW - replaying backfill versions over the
        // current live values would be wrong, so skip them on backfill.
        if (toStartOfTimeline) return;
        this._forwardStateEvent(event);
      } else {
        this._forwardTimelineEvent(event, /*isBackfill=*/toStartOfTimeline === true);
      }
    };
    sdk.on('Room.timeline', this._handlers.roomTimeline);

    this._handlers.sync = (state) => {
      // PREPARED fires once per client lifetime; after an ERROR the sdk
      // resumes with SYNCING/CATCHUP - both mean the loop is healthy.
      if (state === 'PREPARED' || state === 'SYNCING' || state === 'CATCHUP') {
        this._recordSyncSuccess();
      } else if (state === 'ERROR') {
        this._recordSyncFailure();
        this._syncErrored = true;
      }
    };
    sdk.on('sync', this._handlers.sync);
  }

  _forwardStateEvent(event) {
    const type = event.getType();
    const subject = this._subjects.get(type);
    if (subject) {
      // Map matrix-js-sdk event to the expected plain object shape
      subject.next(this._mapEvent(event));
    }

    // Special case: check for tombstone
    if (type === 'm.room.tombstone') {
      this._checkTombstone(event);
    }
  }

  /**
   * Re-dispatch every non-state, non-Yjs event in the room's live
   * timeline as a backfilled `matrix:timeline-event`.
   *
   * Need: the matrix-js-sdk processes initial-sync events DURING
   * `clientManager.init()` (the `await _client.start()` step), but the
   * `matrix:timeline-event` window listener used by `ChatIntegrator`
   * doesn't attach until later in the boot sequence (after
   * `state.init()` resolves). Events that fired in that window
   * silently went nowhere - the GM's own prior-session scenes never
   * reached `activityLog` and the IconRail Scenes drawer stayed empty.
   *
   * Calling this from `ChatIntegrator.init()` (after the listener is
   * attached) closes that gap: every timeline event the SDK already
   * processed gets re-forwarded with `_historical: true`. The
   * downstream `_seenLogEventIds` dedup in `log-panel.js` makes the
   * call idempotent - events that ALSO arrive live (post-attach) are
   * only logged once.
   *
   * State events and Yjs transport events are skipped: state events
   * already applied via `_forwardStateEvent` during sync, and Yjs
   * updates already replayed via `YjsMatrixTransport`. Re-doing either
   * would clobber the live state or double-apply a CRDT update.
   */
  replayLiveTimeline() {
    const sdk = this._matrixClient?.sdk;
    const room = sdk?.getRoom?.(this._roomId);
    if (!room) return 0;
    const timeline = room.getLiveTimeline?.();
    if (!timeline) return 0;
    const events = timeline.getEvents?.() ?? [];
    let forwarded = 0;
    for (const event of events) {
      if (event.isState && event.isState()) continue;
      const type = event.getType?.();
      if (this._yjsTransport && (type === YJS_EVENT_TYPES.UPDATE || type === YJS_EVENT_TYPES.SYNC_VECTOR)) continue;
      this._forwardTimelineEvent(event, /*isBackfill=*/true);
      forwarded += 1;
    }
    return forwarded;
  }

  _forwardTimelineEvent(event, isBackfill = false) {
    const mapped = this._mapEvent(event);
    window.dispatchEvent(new CustomEvent('matrix:timeline-event', {
      detail: {
        ...mapped,
        // Explicit backfill (toStartOfTimeline) is always historical;
        // pre-sync-prepared events are also historical so the live
        // local-echo dedup doesn't fire for them.
        _historical: isBackfill || !this._initialSyncDone,
      },
    }));
  }

  _mapEvent(event) {
    if (typeof event.getType !== 'function') return event;
    return {
      type: event.getType(),
      state_key: event.getStateKey(),
      content: event.getContent(),
      sender: event.getSender(),
      event_id: event.getId(),
      origin_server_ts: event.getTs(),
      room_id: event.getRoomId(),
    };
  }

  async receiveStateEvents(type) {
    const sdk = this._matrixClient.sdk;
    const room = sdk.getRoom(this._roomId);

    if (room && this._initialSyncDone) {
      const events = room.currentState.getStateEvents(type);
      return Array.isArray(events) ? events.map(e => this._mapEvent(e)) : (events ? [this._mapEvent(events)] : []);
    }

    // Fallback if room not in memory or sync not done. sdk.roomState is the
    // SDK's GET /rooms/{id}/state - the inbuilt method we should be calling
    // (the prior `sdk.getRoomState` was a typo that always threw).
    if (!this._stateCachePromise) {
      this._stateCachePromise = sdk.roomState(this._roomId).then(events => {
        setTimeout(() => { this._stateCachePromise = null; }, 1000); // TTL cache
        return events;
      }).catch(err => {
        this._stateCachePromise = null;
        throw err;
      });
    }

    const allEvents = await this._stateCachePromise;
    return allEvents.filter(e => e.type === type).map(e => (e.event_id ? e : this._mapEvent(e)));
  }

  observeStateEvents(type) {
    if (!this._subjects.has(type)) {
      this._subjects.set(type, new Subject());
    }
    return this._subjects.get(type);
  }

  _checkTombstone(eventOrEvents) {
    const events = Array.isArray(eventOrEvents) ? eventOrEvents : [eventOrEvents];
    let found = false;
    for (const event of events) {
      // Support both matrix-js-sdk Event and plain objects (for tests/legacy)
      const content = typeof event.getContent === 'function' ? event.getContent() : (event.content ?? event);
      if (event.type === 'm.room.tombstone' || (typeof event.getType === 'function' && event.getType() === 'm.room.tombstone')) {
        logger.warn('MatrixApiAdapter', 'Room upgraded - notifying user');
        window.dispatchEvent(new CustomEvent(VTT_EVENTS.ROOM_UPGRADED, {
          detail: { replacementRoomId: content?.replacement_room ?? null }
        }));
        this._syncActive = false; // Legacy flag for tests
        found = true;
      }
    }
    return found;
  }

  _recordSyncFailure() {
    this._consecutiveFailures = (this._consecutiveFailures || 0) + 1;
    if (this._consecutiveFailures % 10 === 0) {
      window.dispatchEvent(new CustomEvent(VTT_EVENTS.SYNC_DEAD));
    }
  }

  _recordSyncSuccess() {
    if (!this._initialSyncDone || this._syncErrored) {
      this._initialSyncDone = true;
      window.dispatchEvent(new CustomEvent(VTT_EVENTS.SYNC_RECOVERED));
    }
    this._consecutiveFailures = 0;
    this._syncErrored = false;
  }

  /**
   * Pull-based sync health for UIs that mount after the one-shot
   * SYNC_RECOVERED event already fired (the VTT shell initializes well
   * after the client's initial sync completes on the discovery screen).
   */
  isSyncHealthy() {
    return this._initialSyncDone && !this._syncErrored;
  }

  _getPrioritizedStateEvents(roomData) {
    const state = roomData.state?.events ?? [];
    const timeline = roomData.timeline?.events ?? [];
    const all = [...state, ...timeline].filter(e => e.state_key !== undefined);
    
    // 1. Identify latest event per type+key
    const latestById = new Map();
    for (const e of all) {
      latestById.set(`${e.type}:${e.state_key}`, e.event_id);
    }

    // 2. Return unique events, preserving the order of the last appearance
    const seen = new Set();
    const result = [];
    for (const e of all) {
      if (latestById.get(`${e.type}:${e.state_key}`) === e.event_id) {
        if (!seen.has(e.event_id)) {
          result.push(e);
          seen.add(e.event_id);
        }
      }
    }
    return result;
  }

  /**
   * Paginate the room's live timeline backwards via the SDK and
   * return the newly-prepended (older) events. The previous version
   * sliced the in-memory timeline, which silently returned the same
   * events each call - the log panel's "Load older messages" button
   * appeared functional but never revealed pre-session history.
   *
   * Returns the events older than what was already in the timeline,
   * plus the next pagination token. When scrollback reports no new
   * events the room has no more history to fetch and `hasMoreHistory`
   * flips to false so the UI can hide the button.
   *
   * @param {number} limit
   * @returns {Promise<{chunk: object[], end: string|null}>}
   */
  async getMessages(limit = 100) {
    if (this._stopped) return { chunk: [], end: null };
    const sdk = this._matrixClient.sdk;
    const room = sdk.getRoom(this._roomId);
    if (!room) return { chunk: [], end: null };

    const timeline = room.getLiveTimeline();
    const beforeCount = timeline.getEvents().length;

    try {
      await sdk.scrollback(room, limit);
    } catch (err) {
      logger.warn('[MatrixApiAdapter] scrollback failed', err);
      if (!this._stopped) this.hasMoreHistory = false;
      return { chunk: [], end: null };
    }

    // Honour an in-flight stop - don't touch hasMoreHistory or read
    // the timeline of a room that's being torn down.
    if (this._stopped) return { chunk: [], end: null };

    const after = timeline.getEvents();
    const newCount = after.length - beforeCount;
    if (newCount <= 0) {
      this.hasMoreHistory = false;
      return { chunk: [], end: null };
    }

    // scrollback() prepends older events at indices [0, newCount).
    const chunk = after.slice(0, newCount).map((e) => this._mapEvent(e));
    return {
      chunk,
      end: timeline.getPaginationToken(EventTimeline.BACKWARDS),
    };
  }

  /**
   * Server-side-filtered chat history: m.room.message events only.
   *
   * The room timeline is flooded with com.matrixvtt.yjs.update events,
   * so unfiltered scrollback pages yield ~0 chat entries each. Asking
   * the homeserver to filter means one request returns a full page of
   * real chat. Pagination token is per-adapter (`_chatToken`);
   * `hasMoreChatHistory` flips false at the room start. Widget mode has
   * the same method on its read adapter (already filtered at source).
   *
   * @param {number} limit
   * @returns {Promise<{chunk: object[], end: string|null}>}
   */
  async getChatMessages(limit = 100) {
    if (this._stopped) return { chunk: [], end: null };
    const sdk = this._matrixClient?.sdk ?? this._matrixClient;
    if (!sdk?.createMessagesRequest) return { chunk: [], end: null };

    const filter = new Filter(sdk.credentials?.userId ?? null);
    filter.setDefinition({ room: { timeline: { types: [EVENT_TYPES.ROOM_MESSAGE] } } });

    let res;
    try {
      res = await sdk.createMessagesRequest(this._roomId, this._chatToken, limit, 'b', filter);
    } catch (err) {
      logger.warn('[MatrixApiAdapter] filtered /messages failed', err);
      if (!this._stopped) this.hasMoreChatHistory = false;
      return { chunk: [], end: null };
    }
    if (this._stopped) return { chunk: [], end: null };

    const chunk = (res?.chunk ?? []).map((e) => ({
      event_id: e.event_id,
      type: e.type,
      content: e.content,
      sender: e.sender,
      origin_server_ts: e.origin_server_ts,
    }));
    this._chatToken = res?.end ?? null;
    if (!res?.end || chunk.length === 0) this.hasMoreChatHistory = false;
    return { chunk, end: this._chatToken };
  }

  stopSync() {
    this._stopped = true;
    // Deregister the SDK listeners so a room switch / re-init doesn't leave
    // this adapter's handlers firing against a reused sdk (leak + double
    // processing). Uses the sdk ref captured at setup time.
    if (this._sdk && this._handlers) {
      this._sdk.off?.('RoomState.events', this._handlers.roomStateEvents);
      this._sdk.off?.('Room.timeline', this._handlers.roomTimeline);
      this._sdk.off?.('sync', this._handlers.sync);
      this._handlers = null;
    }
    this._yjsTransport?.destroy?.();
    // The MatrixClient handles stopping the SDK sync loop.
    for (const subject of this._subjects.values()) {
      subject.complete();
    }
    this._subjects.clear();
  }
}
