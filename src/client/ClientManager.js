/**
 * ClientManager
 * Drop-in replacement for WidgetManager for the standalone external frontend.
 * Implements the same public interface using the refactored MatrixClient.
 */

import { MatrixClient } from './MatrixClient.js';
import { MatrixApiAdapter } from './MatrixApiAdapter.js';
import { EVENT_TYPES } from '../utils/constants.js';
import { computeNewPowerLevels } from '../widget/capabilities.js';
import { logger } from '../utils/logger.js';

export class ClientManager {
  constructor({ matrixClientClass = MatrixClient } = {}) {
    this._matrixClientClass = matrixClientClass;
    this.userId = null;
    this.roomId = null;
    this.isStandalone = false;
    this.isAppClient = true;
    this.canLeave = true;
    this.canSetDisplayName = true;
    this.canUploadMedia = true;
    this.userIdResolved = true;
    this.widgetApi = null;

    this._client = null;
    this._apiAdapter = null;
    this._canEditCache = { value: null, expiry: 0 };
    this.serverCapabilities = null;
  }

  get homeserver() { return this._client?.homeserver ?? null; }
  get accessToken() { return this._client?.accessToken ?? null; }
  get roomIdsSupported() { return true; }
  getEarliestRetryTime() { return 0; }

  /**
   * Call this before init() to provide login credentials and room selection.
   */
  setCredentials(homeserver, accessToken, userId, roomId) {
    this._client = new this._matrixClientClass({ homeserver, accessToken, userId });
    this.userId = userId;
    this.roomId = roomId;
  }

  /**
   * Initialise the adapter. Called by app-client.js after setCredentials().
   */
  async init(yjsManager = null) {
    if (!this._client) {
      throw new Error('[ClientManager] setCredentials() must be called before init()');
    }
    // Idempotent: a second init() call must not start the SDK twice or
    // leak the prior api adapter. The second call IS still load-bearing
    // for late Yjs wiring: app-client.js calls init() without a Yjs
    // manager (StateManager hasn't been constructed yet), then
    // StateManager.init() calls widgetManager.init(this.yjs) - without
    // this attach the YjsMatrixTransport would never come up and no
    // com.matrixvtt.yjs.update events would broadcast.
    if (this._apiAdapter) {
      if (yjsManager) this._apiAdapter._attachYjs(yjsManager);
      return;
    }

    await this._client.start();

    this._apiAdapter = new MatrixApiAdapter(this._client, this.roomId, yjsManager);
    this.widgetApi = this._apiAdapter;

    // misconfigured homeservers are visible in the console (the
    // legacy `.catch(() => {})` silently dropped the error and left
    // `serverCapabilities` null with no signal that the call failed).
    this._client.sdk.getCapabilities()
      .then((caps) => { this.serverCapabilities = caps; })
      .catch((err) => {
        logger.warn('ClientManager', 'getCapabilities() failed; serverCapabilities will stay null:', err?.message || err);
      });
  }

  getApi() {
    return this._apiAdapter;
  }

  getYjsTransport() {
    return this._apiAdapter?._yjsTransport ?? null;
  }

  // Cross-room library operations need the raw client; only standalone
  // (app) mode exposes it. Widget mode returns null (single-room scoped).
  getMatrixClient() {
    return this._client;
  }

  getRateLimitWait() {
    // The SDK and our internal throttler handle this. 
    // Return 0 as we don't want external queues to double-throttle.
    return 0;
  }

  async sendStateEvent(type, stateKey, content) {
    return this._client.sendVTTEvent(this.roomId, type, stateKey, content);
  }

  async getRoomState() {
    // matrix-js-sdk types narrow getStateEvents to (eventType, stateKey?) but
    // the runtime accepts () to mean "all types"; cast to any to allow it.
    const sdk = /** @type {any} */ (this._client.sdk);
    const room = sdk.getRoom(this.roomId);
    if (room) {
      return room.currentState.getStateEvents().map(e => ({
        type: e.getType(),
        state_key: e.getStateKey(),
        content: e.getContent(),
        event_id: e.getId()
      }));
    }
    // /sync hasn't yet delivered the room - fetch state directly via the
    // SDK's GET /rooms/{id}/state. (sdk.roomState, not getRoomState.)
    return sdk.roomState(this.roomId);
  }

  async sendRoomEvent(type, content) {
    return this._client.sendVTTEvent(this.roomId, type, null, content);
  }

  async redactEvent(eventId) {
    return this._client.sdk.redactEvent(this.roomId, eventId);
  }

  async getUserPowerLevel() {
    const sdk = this._client.sdk;
    const room = sdk.getRoom(this.roomId);
    if (room) return room.getMember(this.userId)?.powerLevel ?? 0;
    // /sync hasn't yet delivered the room - common immediately after
    // createRoom, since the wizard fires before the new room reaches the
    // SDK store. Read power levels straight off the homeserver via the
    // SDK's roomState so the creator sees the GM wizard instead of
    // "Waiting for GM".
    try {
      const state = await sdk.roomState(this.roomId);
      const pl = Array.isArray(state)
        ? state.find(e => e.type === 'm.room.power_levels')?.content
        : null;
      return pl?.users?.[this.userId] ?? pl?.users_default ?? 0;
    } catch {
      return 0;
    }
  }

  async canEditRoomState() {
    const now = Date.now();
    if (now < this._canEditCache.expiry) return this._canEditCache.value;
    const result = (await this.getUserPowerLevel()) >= 50;
    this._canEditCache = { value: result, expiry: now + 30000 };
    return result;
  }

  // Errors propagate: the caller (ensurePlayerPowerLevels) owns the
  // retry and the user-facing surfacing. Swallowing here made a failed
  // GM/player split invisible until players hit generic write errors.
  async setRoomPowerLevels(gmUserIds = []) {
    const sdk = this._client.sdk;
    const room = sdk.getRoom(this.roomId);
    const current = room?.currentState.getStateEvents('m.room.power_levels', '')?.getContent() || {};
    const newPowerLevels = computeNewPowerLevels(current, gmUserIds);
    await this.sendStateEvent(EVENT_TYPES.POWER_LEVELS, '', newPowerLevels);
    this._canEditCache = { value: null, expiry: 0 };
  }

  async getRoomMembers() {
    const sdk = this._client.sdk;
    const room = sdk.getRoom(this.roomId);
    if (!room) return [];

    return room.getJoinedMembers().map(m => ({
      userId: m.userId,
      displayname: m.name || m.userId,
      inCall: false // Call membership would need more complex logic with current SDK
    }));
  }

  async getPendingKnocks() {
    const room = this._client.sdk.getRoom(this.roomId);
    if (!room) return [];
    return room.getMembersWithMembership('knock').map((m) => ({
      userId: m.userId,
      displayname: m.name || m.userId,
      reason: m.events?.member?.getContent?.()?.reason ?? '',
    }));
  }

  async inviteUser(userId) {
    return this._client.sdk.invite(this.roomId, userId);
  }

  async kickUser(userId, reason = 'Kicked by GM') {
    return this._client.sdk.kick(this.roomId, userId, reason);
  }

  async banUser(userId, reason = 'Banned by GM') {
    return this._client.sdk.ban(this.roomId, userId, reason);
  }

  async setDisplayName(displayName) {
    // Per-room member event, not the global /profile API, so the rename
    // stays scoped to this room (/myroomnick, not /nick).
    return this._client.setRoomDisplayName(this.roomId, displayName);
  }

  async uploadMedia(file) {
    const res = await this._client.sdk.uploadContent(file);
    return res.content_uri;
  }

  destroy() {
    this._apiAdapter?.stopSync();
    this._client?.stop();
    this._apiAdapter = this.widgetApi = null;
  }
}
