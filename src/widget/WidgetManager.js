/**
 * WidgetManager - bridge between the MatrixVTT app and the Matrix widget API.
 * The host client owns the sync loop; all reads and writes go through
 * the widget API.
 */

import { WidgetApiImpl } from '@matrix-widget-toolkit/api';
import { logger } from '../utils/logger.js';
import {
  buildCapabilities,
  verifyCapabilities,
  requiredSendCapabilities,
} from './capabilities.js';
import {
  getRoomState,
  getUserPowerLevel,
  canEditRoomState,
  setRoomPowerLevels,
  getRoomMembers,
  getPendingKnocks,
  inviteUser,
  kickUser,
  banUser,
  setRoomDisplayName,
} from './room-adapter.js';
import { createStandaloneWidgetApi, showStandaloneWarning } from './standalone-stub.js';
import { isRateLimitError } from '../utils/matrixRetry.js';
import { createWidgetReadAdapter } from './widgetReadAdapter.js';
import { attachWidgetYjs } from './widget-yjs.js';
import { fetchUserIdFromOpenID } from './openid.js';
import { EVENT_TYPES, VTT_EVENTS } from '../utils/constants.js';

export class WidgetManager {
  constructor() {
    this.widgetApi = null; // The Widget API (for capabilities)
    this.vttApi = null;    // The MatrixApiAdapter (for syncing)
    this.roomId = null;
    this.userId = null;
    this.isStandalone = false;
    this.isAppClient = false;
    this.homeserver = null;
    this.userIdResolved = false;

    this._canEditCache = { value: null, expiry: 0 };
    // null = not yet probed; room-adapter's withRoomIdFallback sets it.
    this._roomIdsSupported = null;
    this._yjsTransport = null;
    this._rateLimitedUntil = 0;
  }

  async init(yjsManager = null) {
    if (this.widgetApi || this.isStandalone) {
      if (yjsManager && this.widgetApi && !this.isStandalone) {
        attachWidgetYjs(this, yjsManager);
      }
      return;
    }

    if (window.self === window.top) {
      logger.warn('WidgetManager', 'Not running in widget context. Using standalone mode.');
      this.initStandalone();
      return;
    }

    try {
      this.widgetApi = await WidgetApiImpl.create();
      await this.widgetApi.requestCapabilities(buildCapabilities());

      const missing = verifyCapabilities(this.widgetApi, requiredSendCapabilities());
      if (missing.length > 0) {
        logger.error('WidgetManager', 'Required capabilities denied:', missing);
      }

      await this.extractWidgetContext();

      // The OpenID credential from requestOpenIDConnectToken is not a
      // client-server access token: it can only be exchanged at the
      // federation /openid/userinfo endpoint. Running matrix-js-sdk on
      // it 401s every /sync ("Lost connection to Matrix updates"). The
      // host client owns the room sync, so widget mode always talks
      // through the widget API.
      this.vttApi = createWidgetReadAdapter(this.widgetApi);
      if (yjsManager) attachWidgetYjs(this, yjsManager);

      this.subscribeToTombstone();
    } catch (error) {
      logger.error('WidgetManager', 'Initialization failed:', error);
      throw new Error(`Widget initialization failed: ${error.message}`, { cause: error });
    }
  }

  async extractWidgetContext() {
    const urlParams = new URLSearchParams(window.location.search);

    // Room id, in priority order: the toolkit's parsed widgetParameters
    // (a matrix_room_id=$matrix_room_id template param), a raw ?roomId=
    // param, then the legacy widgetId prefix. /addwidget widgets get no
    // widgetId URL param, so without an explicit room param the widget
    // targeted "unknown-room", every power-level read missed, and the
    // room creator saw "Waiting for GM".
    const isRoomId = (v) => typeof v === 'string' && v.startsWith('!');
    const fromToolkitRoom = /** @type {any} */ (this.widgetApi?.widgetParameters)?.roomId;
    const fromUrlRoom = urlParams.get('roomId') ?? urlParams.get('matrix_room_id');
    if (isRoomId(fromToolkitRoom)) {
      this.roomId = fromToolkitRoom;
    } else if (isRoomId(fromUrlRoom)) {
      this.roomId = fromUrlRoom;
    } else {
      const widgetIdParam = urlParams.get('widgetId');
      if (widgetIdParam) {
        const parts = decodeURIComponent(widgetIdParam).split('_');
        if (parts.length >= 1) this.roomId = parts[0];
      }
    }

    // The toolkit's observeStateEvents throws "Current room id is
    // unknown" whenever its own widgetParameters.roomId is empty, and
    // it only parses a matrix_room_id URL param. Write the resolved
    // room id back so live subscriptions work regardless of how the
    // widget URL spelled it.
    const toolkitParams = /** @type {any} */ (this.widgetApi)?.widgetParameters;
    if (toolkitParams && !isRoomId(toolkitParams.roomId) && isRoomId(this.roomId)) {
      toolkitParams.roomId = this.roomId;
    }

    // Prefer the widget toolkit's parsed widgetParameters.userId - it
    // comes from the same URL template params Element substitutes, but
    // is already validated and normalized by the toolkit. Fall back to
    // raw URL parsing for callers that wired the manager without a
    // toolkit-backed widgetApi.
    const fromToolkit = /** @type {any} */ (this.widgetApi?.widgetParameters)?.userId;
    if (typeof fromToolkit === 'string' && fromToolkit.startsWith('@') && fromToolkit.includes(':')) {
      this.userId = fromToolkit;
      this.userIdResolved = true;
    } else {
      const userIdParam = urlParams.get('userId');
      if (userIdParam?.startsWith('@') && userIdParam.includes(':')) {
        this.userId = userIdParam;
        this.userIdResolved = true;
      }
    }

    try {
      const credentials = await this.widgetApi.requestOpenIDConnectToken();
      if (credentials?.access_token && credentials?.matrix_server_name) {
        this.homeserver = `https://${credentials.matrix_server_name}`;

        if (!this.userIdResolved) {
          const openIdUserId = await fetchUserIdFromOpenID(credentials);
          if (openIdUserId) {
            this.userId = openIdUserId;
            this.userIdResolved = true;
          }
        }
      }
    } catch (error) {
      logger.error('WidgetManager', 'Failed to get OpenID credentials:', error);
    }

    if (!this.userId) this.userId = '@unknown:server';
    if (!this.roomId) this.roomId = 'unknown-room';
    logger.log('WidgetManager', `context resolved: room ${this.roomId}, user ${this.userId}`);
  }

  initStandalone() {
    this.isStandalone = true;
    this.userIdResolved = true;
    this.roomId = 'standalone-room';
    this.userId = '@standalone:localhost';
    this.widgetApi = createStandaloneWidgetApi();
    this.vttApi = this.widgetApi;
    showStandaloneWarning();
  }

  getApi() {
    return this.vttApi || this.widgetApi;
  }

  getYjsTransport() {
    return this._yjsTransport;
  }

  // Widget mode is single-room scoped: no raw cross-room client. The
  // content library is hidden here; returning null keeps the same public
  // API as ClientManager while gating the data layer.
  getMatrixClient() {
    return null;
  }

  async sendStateEvent(type, stateKey, content) {
    try {
      return await this.widgetApi.sendStateEvent(type, content, { stateKey });
    } catch (error) {
      this._noteRateLimit(error);
      throw error;
    }
  }

  async sendRoomEvent(type, content) {
    try {
      return await this.widgetApi.sendRoomEvent(type, content);
    } catch (error) {
      this._noteRateLimit(error);
      throw error;
    }
  }

  _noteRateLimit(error) {
    if (!isRateLimitError(error)) return;
    const server = Number(error?.data?.retry_after_ms ?? error?.retry_after_ms);
    const wait = Number.isFinite(server) && server > 0 ? server : 5000;
    this._rateLimitedUntil = Math.max(this._rateLimitedUntil, Date.now() + wait);
  }

  async redactEvent(eventId) {
    return this.widgetApi.sendRoomEvent('m.room.redaction', { redacts: eventId });
  }

  subscribeToTombstone() {
    const api = this.getApi();
    api.observeStateEvents(EVENT_TYPES.TOMBSTONE).subscribe((event) => {
      if (event && event.type === EVENT_TYPES.TOMBSTONE) {
        window.dispatchEvent(new CustomEvent(VTT_EVENTS.ROOM_UPGRADED, {
          detail: { replacementRoomId: event.content?.replacement_room ?? null }
        }));
      }
    });
  }

  getRoomState() { return getRoomState(this); }
  getUserPowerLevel() { return getUserPowerLevel(this); }
  canEditRoomState() { return canEditRoomState(this); }
  setRoomPowerLevels(gmUserIds) { return setRoomPowerLevels(this, gmUserIds); }
  async getRoomMembers() { return getRoomMembers(this); }
  getPendingKnocks() { return getPendingKnocks(this); }
  inviteUser(userId) { return inviteUser(this, userId); }
  kickUser(userId, reason) { return kickUser(this, userId, reason); }
  banUser(userId, reason) { return banUser(this, userId, reason); }

  async setDisplayName(displayName) {
    // Per-room member event, not the global /profile API, so the rename
    // stays scoped to this room (/myroomnick, not /nick).
    return setRoomDisplayName(this, displayName);
  }

  async uploadMedia(file) {
    return /** @type {any} */ (this.widgetApi).uploadMedia(file);
  }

  destroy() {
    this._yjsTransport?.destroy();
    this.widgetApi = null;
    this.vttApi = null;
  }

  getRateLimitWait() { return Math.max(0, this._rateLimitedUntil - Date.now()); }
  getEarliestRetryTime() { return 0; }
}
