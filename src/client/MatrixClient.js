
import * as sdk from 'matrix-js-sdk';
import { EVENT_TYPES, VTT_EVENTS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import { retryOnRateLimit } from '../utils/matrixRetry.js';
import { isLocalHost } from '../utils/local-host.js';
import { viaServersFor } from '../utils/matrix-ids.js';

export const CLIENT_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  AUTH_ERROR: 'auth_error',
  OFFLINE: 'offline',
};

export class MatrixClient {
  constructor({ homeserver, accessToken, userId }) {
    this.homeserver = MatrixClient._getHsBase(homeserver);
    this.accessToken = accessToken;
    this.userId = userId;

    this.sdk = null;
    this.status = CLIENT_STATUS.DISCONNECTED;
    this._statusListeners = new Set();

    // Per-event-type throttling & backpressure.
    //
    // Matrix homeservers rate-limit per-room sends (Synapse `rc_message`
    // and similar) and respond with HTTP 429 when a client exceeds the
    // configured bucket. matrix-js-sdk does not implement per-event-
    // type backpressure, so we apply it here for the two high-frequency
    // event classes that would otherwise burst past the limit:
    //
    //   TOKEN   coalesce 400 ms - a token drag fires updates per
    //           mouse-tick; coalescing collapses them into one event
    //           per cell of movement.
    //   DRAWING stream every 100 ms with a hard 50-event queue cap -
    //           long pen strokes shed mid-stroke samples rather than
    //
    // Other event types are user-initiated (saves, settings changes)
    // and stay well under the bucket without help.
    this._throttles = {
      [EVENT_TYPES.TOKEN]: {
        strategy: 'coalesce',
        pending: new Map(), // key -> content
        timer: null,
        delay: 400,
      },
      [EVENT_TYPES.DRAWING]: {
        strategy: 'stream',
        queue: [],
        timer: null,
        delay: 100,
        maxQueue: 50, // Hard upper bound for backpressure
      },
    };

    // Logical clock for deterministic LWW in tokens
    this._logicalClock = 0;

    // Persist the synced timeline across reloads. Without a store the SDK
    // keeps everything in memory, so a refresh refetches only the last
    // `initialSyncLimit` timeline events - and the chatty Yjs *timeline*
    // updates evict chat m.room.message events from that window, making sent
    // messages look like they vanished. An IndexedDB store keeps the timeline
    // (and sync token) on disk so chat survives a reload.
    this._store = MatrixClient._createStore(this.userId);

    this.sdk = sdk.createClient(/** @type {any} */ ({
      baseUrl: this.homeserver,
      accessToken: this.accessToken,
      userId: this.userId,
      useCrypto: false,
      ...(this._store ? { store: this._store } : {}),
    }));
  }

  /**
   * Build the SDK sync store. Uses an IndexedDB-backed store (so the timeline
   * persists across reloads) scoped per-user - logging in as another account
   * must never read the previous user's cache. Falls back to the SDK default
   * (in-memory) wherever IndexedDB is missing or refuses to open (SSR, tests,
   * private-mode quota errors).
   * @param {string} userId
   */
  static _createStore(userId) {
    try {
      if (typeof indexedDB === 'undefined' || !sdk.IndexedDBStore) return null;
      return new sdk.IndexedDBStore(/** @type {any} */ ({
        indexedDB,
        localStorage: typeof localStorage !== 'undefined' ? localStorage : undefined,
        dbName: `matrixvtt:${userId}`,
      }));
    } catch (err) {
      logger.warn('MatrixClient', `IndexedDB store unavailable, using memory: ${err?.message || err}`);
      return null;
    }
  }

  /**
   * Delete the persisted IndexedDB sync store for a user. Called on factory
   * reset / logout so "delete all local data" actually clears the cached
   * timeline + sync token (the store survives localStorage.clear()).
   * matrix-js-sdk prefixes the dbName we pass with "matrix-js-sdk:".
   * @param {string} userId
   */
  static deleteStoreData(userId) {
    if (typeof indexedDB === 'undefined' || !userId) return Promise.resolve();
    const dbName = `matrix-js-sdk:matrixvtt:${userId}`;
    return new Promise((resolve) => {
      try {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Start the SDK client sync loop.
   */
  async start() {
    this._setStatus(CLIENT_STATUS.CONNECTING);

    try {
      // matrix-js-sdk's emitter type unions vary across versions; treat as
      // any to cover the legacy event names we still listen on.
      const sdkAny = /** @type {any} */ (this.sdk);
      sdkAny.on('Session.logged_out', (error) => {
        if (error?.data?.errcode === 'M_UNKNOWN_TOKEN') {
          this._handleAuthError();
        }
      });

      sdkAny.on('sync', (state, _prevState, _data) => {
        if (state === 'PREPARED') {
          this._setStatus(CLIENT_STATUS.CONNECTED);
        } else if (state === 'ERROR') {
          this._setStatus(CLIENT_STATUS.OFFLINE);
        } else if (state === 'RECONNECTING') {
          this._setStatus(CLIENT_STATUS.CONNECTING);
        }
      });

      // Load the persisted store before syncing so the saved timeline (and
      // since-token) are in place; the sync then resumes incrementally rather
      // than refetching from scratch. Degrade to memory if startup fails.
      if (this._store?.startup) {
        try {
          await this._store.startup();
        } catch (err) {
          logger.warn('MatrixClient', `store startup failed, continuing degraded: ${err?.message || err}`);
        }
      }

      // 50 (not 10): the room timeline is interleaved with frequent Yjs
      // state-sync events, so a small window is almost all Yjs noise and the
      // chat/scene feed comes up empty on first paint. A wider window carries
      // real history before backfill (chat-integrator.backfillRecentHistory)
      // pages the rest in.
      await this.sdk.startClient({ initialSyncLimit: 50 });
    } catch (err) {
      logger.error('MatrixClient', 'Failed to start', err);
      this._setStatus(CLIENT_STATUS.OFFLINE);
      throw err;
    }
  }

  async stop() {
    // Clear pending throttle timers BEFORE tearing down the sdk so a queued
    // coalesce/stream tick can't fire after `this.sdk` is null (unhandled
    // rejection) and pending writes don't linger against a dead client.
    this._clearThrottles();
    if (this.sdk) {
      await this.sdk.stopClient();
      this.sdk = null;
    }
    this._setStatus(CLIENT_STATUS.DISCONNECTED);
  }

  _clearThrottles() {
    for (const t of Object.values(this._throttles)) {
      if (t.timer) {
        clearTimeout(t.timer);
        clearInterval(t.timer);
        t.timer = null;
      }
      t.pending?.clear();
      if (t.queue) t.queue.length = 0;
    }
  }

  onStatusUpdate(callback) {
    this._statusListeners.add(callback);
    callback(this.status);
    return () => this._statusListeners.delete(callback);
  }

  _setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    this._statusListeners.forEach((cb) => cb(status));
  }

  _handleAuthError() {
    logger.error('MatrixClient', 'Auth error detected');
    this._setStatus(CLIENT_STATUS.AUTH_ERROR);
    this.stop();
    // Dispatch global event for UI to handle (e.g., redirect to login)
    window.dispatchEvent(new CustomEvent(VTT_EVENTS.ERROR, {
      detail: { message: 'Session expired. Please log in again.', code: 'AUTH_ERROR' }
    }));
  }

  /**
   * Send a VTT event with channel-specific throttling.
   */
  async sendVTTEvent(roomId, type, stateKey, content) {
    if (this.status !== CLIENT_STATUS.CONNECTED) {
      throw new Error(`Cannot send event in status: ${this.status}`);
    }

    const throttle = this._throttles[type];
    if (!throttle) {
      // No throttling for this type (e.g. settings, chat)
      return this._sendImmediately(roomId, type, stateKey, content);
    }

    if (throttle.strategy === 'coalesce') {
      return this._queueCoalesced(roomId, type, stateKey, content, throttle);
    } else if (throttle.strategy === 'stream') {
      return this._queueStreamed(roomId, type, stateKey, content, throttle);
    }
  }

  async _sendImmediately(roomId, type, stateKey, content) {
    // A throttle tick can race teardown; never send against a dead sdk.
    if (!this.sdk) return;
    try {
      // Honor server rate limits: the Yjs update / sync-vector firehose
      // and the coalesced/streamed throttles all funnel through here,
      // and matrix.org 429s a normal editing burst. retryOnRateLimit
      // backs off on `retry_after_ms` (429 only); every other error
      // still bubbles on the first attempt so auth failures below are
      // handled immediately.
      return await retryOnRateLimit(() => {
        if (stateKey !== null && stateKey !== undefined) {
          return this.sdk.sendStateEvent(roomId, type, content, stateKey);
        }
        return this.sdk.sendEvent(roomId, type, content);
      });
    } catch (err) {
      // 401 and invalid-token errors end the session. A plain 403
      // M_FORBIDDEN is a power-level rejection (e.g. a player touching
      // GM-only state) and must not tear down a healthy connection.
      const errcode = err.errcode ?? err.data?.errcode;
      const isAuthFailure =
        err.httpStatus === 401 ||
        errcode === 'M_UNKNOWN_TOKEN' ||
        errcode === 'M_MISSING_TOKEN';
      if (isAuthFailure) {
        this._handleAuthError();
      }
      throw err;
    }
  }

  /**
   * Coalescing strategy: Send only the latest state after a delay.
   * Used for high-frequency state updates like token movement.
   */
  _queueCoalesced(roomId, type, stateKey, content, throttle) {
    this._logicalClock++;
    const enrichedContent = {
      ...content,
      _v: this._logicalClock,
    };

    const key = `${roomId}\0${type}\0${stateKey}`;
    throttle.pending.set(key, enrichedContent);

    if (!throttle.timer) {
      throttle.timer = setTimeout(async () => {
        const pending = Array.from(throttle.pending.entries());
        throttle.pending.clear();
        throttle.timer = null;

        for (const [pKey, pContent] of pending) {
          const [pRoomId, pType, pStateKey] = pKey.split('\0');
          await this._sendImmediately(pRoomId, pType, pStateKey, pContent).catch(err => {
            logger.error('MatrixClient', `Failed to send coalesced ${pType}`, err);
          });
        }
      }, throttle.delay);
    }

    return Promise.resolve(); // Resolves when queued
  }

  /**
   * Streaming strategy: Queue updates and send at a fixed interval.
   * Used for drawing paths.
   */
  _queueStreamed(roomId, type, stateKey, content, throttle) {
    // Backpressure: Drop oldest if queue is too large
    if (throttle.queue.length >= throttle.maxQueue) {
      throttle.queue.shift();
    }

    throttle.queue.push({ roomId, stateKey, content });

    if (!throttle.timer) {
      throttle.timer = setInterval(async () => {
        if (throttle.queue.length === 0) {
          clearInterval(throttle.timer);
          throttle.timer = null;
          return;
        }

        const { roomId: rId, stateKey: rStateKey, content: rContent } = throttle.queue.shift();
        await this._sendImmediately(rId, type, rStateKey, rContent).catch(err => {
          logger.error('MatrixClient', `Failed to send streamed ${type}`, err);
        });
      }, throttle.delay);
    }

    return Promise.resolve();
  }

  async getJoinedRooms() {
    const data = await this.sdk.getJoinedRooms();
    return data?.joined_rooms ?? [];
  }

  async joinRoom(idOrAlias, extraVia = []) {
    const via = [...new Set([...extraVia, ...viaServersFor(idOrAlias)])];
    const room = await this.sdk.joinRoom(idOrAlias, via.length ? { viaServers: via } : undefined);
    return room?.roomId;
  }

  async leaveRoom(roomId) {
    await this.sdk.leave(roomId);
    try { await this.sdk.forget(roomId); }
    catch { /* leave succeeded; forget is best-effort */ }
  }

  async getRoomState(roomId) {
    return await this.sdk.roomState(roomId);
  }

  async getStateEventContent(roomId, type, stateKey) {
    try {
      return await this.sdk.getStateEvent(roomId, type, stateKey);
    } catch {
      return null;
    }
  }

  async getRoomName(roomId) {
    try {
      const data = await this.sdk.getStateEvent(roomId, 'm.room.name', '');
      return data?.name || roomId;
    } catch {
      return roomId;
    }
  }

  async getVttState(roomId) {
    try {
      return await this.sdk.getStateEvent(roomId, 'com.vtt.settings', '');
    } catch {
      return null;
    }
  }

  async getInvitedRooms() {
    const filter = JSON.stringify({
      room: { invite_state: { types: ['m.room.name', 'm.room.member', 'm.room.join_rules'] }, timeline: { limit: 0 } },
      presence: { types: [] },
      account_data: { types: [] },
    });
    // Bypass the /sync long-poll loop: a one-shot filtered probe lets us
    // surface pending invites on the discovery screen without starting
    // the full sync. Routed through the SDK's HTTP layer for consistency.
    const sdkAny = /** @type {any} */ (this.sdk);
    const data = await sdkAny.http.authedRequest('GET', '/sync', { filter, timeout: 0 });
    const invites = data?.rooms?.invite || {};
    return Object.entries(invites).map(([roomId, summary]) => {
      const events = summary?.invite_state?.events || [];
      const nameEv = events.find((e) => e.type === 'm.room.name');
      const ownMemberEv = events.find((e) => e.type === 'm.room.member' && e.state_key === this.userId);
      const inviterId = ownMemberEv?.sender || null;
      const inviterMemberEv = inviterId
        ? events.find((e) => e.type === 'm.room.member' && e.state_key === inviterId)
        : null;
      const inviterName = inviterMemberEv?.content?.displayname || inviterId;
      const fallbackName = inviterName ? `Invite from ${inviterName}` : roomId;
      return {
        roomId,
        name: nameEv?.content?.name || fallbackName,
        inviter: inviterId,
      };
    });
  }

  async getProfile(userId) {
    return await this.sdk.getProfileInfo(userId);
  }

  async logout() {
    return await this.sdk.logout();
  }

  async sync(since, timeout, filter, signal) {
    const params = {};
    if (since) params.since = since;
    if (timeout != null) params.timeout = String(timeout);
    if (filter) params.filter = filter;
    const sdkAny = /** @type {any} */ (this.sdk);
    return sdkAny.http.authedRequest('GET', '/sync', params, undefined, { abortSignal: signal });
  }

  async createRoom(name, { initialState = [] } = {}) {
    const opts = { name, preset: sdk.Preset.PrivateChat };
    if (initialState.length) opts.initial_state = initialState;
    const res = await this.sdk.createRoom(opts);
    return res?.room_id;
  }

  async resolveRoomAlias(alias) {
    const res = await this.sdk.getRoomIdForAlias(alias);
    return res?.room_id;
  }

  async getRoomMembers(roomId) {
    const res = await this.sdk.getJoinedRoomMembers(roomId);
    const joined = res?.joined ?? {};
    return Object.entries(joined).map(([userId, info]) => ({
      userId,
      displayname: info?.display_name || userId,
    }));
  }

  async setRoomDisplayName(roomId, displayName) {
    // The SDK types narrow sendStateEvent's eventType to a fixed union
    // that doesn't include 'm.room.member'; cast to any to allow the
    // legitimate per-user member-event write that backs this helper.
    const sdkAny = /** @type {any} */ (this.sdk);
    let existing;
    try {
      existing = await sdkAny.getStateEvent(roomId, 'm.room.member', this.userId);
    } catch {
      existing = {};
    }
    const body = { ...existing, membership: 'join', displayname: displayName };
    return sdkAny.sendStateEvent(roomId, 'm.room.member', body, this.userId);
  }

  async upgradeRoom(roomId, newVersion = '11') {
    const res = await this.sdk.upgradeRoom(roomId, newVersion);
    return res?.replacement_room;
  }

  async knockRoom(roomId, reason = '') {
    const via = viaServersFor(roomId);
    const res = await this.sdk.knockRoom(roomId, via.length ? { reason, viaServers: via } : { reason });
    return res?.room_id ?? roomId;
  }

  static _normalizeHs(server) {
    let s = String(server || '').trim();
    // Strip any number of leading `https://` / `http:/` prefixes. A single
    // non-nested regex avoids the ReDoS risk of `^(https?[:/]+)+`.
    let prev;
    do {
      prev = s;
      s = s.replace(/^https?[:/]+/i, '');
    } while (s !== prev);
    return s.replace(/\/+$/, '');
  }

  static _getHsBase(server) {
    const host = this._normalizeHs(server);
    if (!host) return '';
    // Explicit http:// survives for local development homeservers only
    // (mirrors standalone/auth.js normalizeHomeserver).
    const explicitHttp = /^http:\/\//i.test(String(server || '').trim());
    const scheme = explicitHttp && isLocalHost(host) ? 'http' : 'https';
    return `${scheme}://${host}`;
  }

  static async discoverHomeserver(server) {
    const host = this._normalizeHs(server);
    if (!host) return '';
    try {
      const result = await sdk.AutoDiscovery.findClientConfig(host);
      const baseUrl = result?.['m.homeserver']?.base_url;
      return baseUrl?.replace(/\/+$/, '') || this._getHsBase(server);
    } catch {
      return this._getHsBase(server);
    }
  }

  static async getLoginFlows(homeserver) {
    const base = this._getHsBase(homeserver);
    if (!base) return [];
    const client = sdk.createClient({ baseUrl: base });
    const { flows } = await client.loginFlows();
    return flows ?? [];
  }

  static getSSORedirectURL(homeserver, redirectUrl) {
    const base = this._getHsBase(homeserver);
    const client = sdk.createClient({ baseUrl: base });
    return client.getSsoLoginUrl(redirectUrl);
  }

  /**
   * One /register round of the UIA dance. A 401 with a session is the
   * server's stage challenge, not a failure; everything else throws.
   * @returns {Promise<{done: true, credentials: any} | {done: false, uia: any}>}
   */
  static async register(homeserver, body) {
    const base = this._getHsBase(homeserver);
    const client = sdk.createClient({ baseUrl: base });
    try {
      const credentials = await /** @type {any} */ (client).registerRequest(body);
      return { done: true, credentials };
    } catch (err) {
      const e = /** @type {any} */ (err);
      if (e?.httpStatus === 401 && e?.data?.session) {
        return { done: false, uia: e.data };
      }
      throw err;
    }
  }

  static async requestRegisterEmailToken(homeserver, email, clientSecret, sendAttempt) {
    const base = this._getHsBase(homeserver);
    const client = sdk.createClient({ baseUrl: base });
    return /** @type {any} */ (client).requestRegisterEmailToken(email, clientSecret, sendAttempt);
  }

  static async login(homeserver, identifier, password) {
    const base = this._getHsBase(homeserver);
    const client = sdk.createClient({ baseUrl: base });
    return client.login('m.login.password', {
      identifier: { type: 'm.id.user', user: identifier },
      password,
    });
  }

  static async loginWithToken(homeserver, accessToken) {
    const base = this._getHsBase(homeserver);
    const client = sdk.createClient({ baseUrl: base, accessToken });
    const { user_id } = await client.whoami();
    return { access_token: accessToken, user_id };
  }

  static async loginWithSSOToken(homeserver, loginToken) {
    const base = this._getHsBase(homeserver);
    const client = sdk.createClient({ baseUrl: base });
    return client.login('m.login.token', { token: loginToken });
  }
}
