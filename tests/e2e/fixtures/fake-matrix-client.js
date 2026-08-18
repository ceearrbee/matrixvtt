/**
 * Fake MatrixClient - installed into the page via Playwright's
 * `page.addInitScript` before the standalone app boots. The real
 * MatrixClient hits a Matrix homeserver; the fake holds an in-memory
 * Map of state events and returns canned auth payloads so the VTT
 * shell can render against deterministic state with no network.
 *
 * Production never sets `window.__VTT_E2E_MATRIX_CLIENT_CLASS`;
 * `app.html`'s inline bootstrap reads it as an optional override.
 *
 * Surface only covers what the app actually calls. Add methods as
 * new specs need them.
 */
(function installFakeMatrixClient() {
  const HOMESERVER = 'https://fake.matrix.test';
  const USER_ID = '@playwright:fake.matrix.test';
  const ACCESS_TOKEN = 'fake_access_token_e2e';
  const DEFAULT_ROOM_ID = '!playwright-room:fake.matrix.test';
  const DEFAULT_ROOM_NAME = 'Playwright Test Room';

  // Tests can override these via window.__VTT_E2E_CONFIG before navigation.
  function cfg() {
    return Object.assign(
      {
        roomId: DEFAULT_ROOM_ID,
        roomName: DEFAULT_ROOM_NAME,
        displayName: 'Playwright User',
        initialState: [],
        userId: USER_ID,
        powerLevel: 100,
        loginFlows: [{ type: 'm.login.password' }],
        knocks: [],
      },
      window.__VTT_E2E_CONFIG || {},
    );
  }

  // Persist a config override so later cfg() calls observe it. cfg()
  // returns a fresh merged copy, so mutating its result is a silent
  // no-op - the bug that made createRoom lose the new room id.
  function setCfg(patch) {
    window.__VTT_E2E_CONFIG = Object.assign({}, window.__VTT_E2E_CONFIG || {}, patch);
  }

  // The snapshot scheduler republishes com.matrixvtt.yjs.snapshot chunks
  // under a fresh `${marker}-${idx}` state key after every edit burst, so
  // an unbounded Map grows for the lifetime of a spec. Mirror production
  // semantics instead: tombstones (empty content) clear the key, and the
  // map is LRU-bounded so stale snapshot generations age out.
  const MAX_STATE_EVENTS_PER_ROOM = 500;

  function isTombstone(content) {
    return !content || (typeof content === 'object' && Object.keys(content).length === 0);
  }

  function putStateEvent(roomMap, key, event) {
    if (isTombstone(event.content)) {
      roomMap.delete(key);
      return;
    }
    if (roomMap.has(key)) roomMap.delete(key);
    roomMap.set(key, event);
    while (roomMap.size > MAX_STATE_EVENTS_PER_ROOM) {
      roomMap.delete(roomMap.keys().next().value);
    }
  }

  // Everything the app sends is appended here (bounded) so specs can
  // assert on outbound traffic, e.g. that a token move produced a
  // com.matrixvtt.yjs.update timeline event.
  function recordSend(entry) {
    const sent = (window.__VTT_E2E_SENT_EVENTS = window.__VTT_E2E_SENT_EVENTS || []);
    sent.push(entry);
    if (sent.length > 500) sent.splice(0, sent.length - 500);
  }

  class FakeSdkEventEmitter {
    constructor() { this._listeners = new Map(); }
    on(name, fn) {
      if (!this._listeners.has(name)) this._listeners.set(name, new Set());
      this._listeners.get(name).add(fn);
    }
    off(name, fn) { this._listeners.get(name)?.delete(fn); }
    removeListener(name, fn) { this.off(name, fn); }
    emit(name, ...args) {
      for (const fn of this._listeners.get(name) ?? []) fn(...args);
    }
  }

  // sdk-shaped wrapper for a plain state event, as RoomState.events
  // handlers (MatrixApiAdapter) expect.
  function sdkShapedEvent(e) {
    return {
      getType: () => e.type,
      getStateKey: () => e.state_key,
      getContent: () => e.content,
      getSender: () => e.sender,
      getId: () => e.event_id,
      getTs: () => e.origin_server_ts,
      getRoomId: () => e.room_id,
      isState: () => true,
      isRedacted: () => false,
      event: e,
    };
  }

  function memberStateEvent(userId, membership, extra = {}) {
    return sdkShapedEvent({
      type: 'm.room.member',
      state_key: userId,
      content: Object.assign({ membership }, extra),
      event_id: `$fake-member-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      origin_server_ts: Date.now(),
      sender: userId,
      room_id: cfg().roomId,
    });
  }

  function makeFakeSdk(stateEventsByRoom) {
    const emitter = new FakeSdkEventEmitter();
    const fakeRoom = {
      currentState: {
        // Honour the optional type filter the way matrix-js-sdk does
        // (returns only events of that type when supplied; everything
        // otherwise). Required so the snapshot loader's
        // api.receiveStateEvents('com.matrixvtt.yjs.snapshot') call
        // doesn't see raw entity events leak through the fake.
        getStateEvents: (type) => Array.from(stateEventsByRoom.values()).flatMap((m) =>
          Array.from(m.values())
            .filter((e) => !type || e.type === type)
            .map((e) => ({
              getType: () => e.type,
              getStateKey: () => e.state_key,
              getContent: () => e.content,
              getSender: () => e.sender,
              getId: () => e.event_id,
              getTs: () => e.origin_server_ts,
              getRoomId: () => e.room_id,
              event: e,
            })),
        ),
      },
      timeline: [],
      getLiveTimeline: () => ({ getEvents: () => [] }),
      getMember: () => ({ powerLevel: cfg().powerLevel }),
      getMembersWithMembership: (membership) => membership === 'knock'
        ? cfg().knocks.map((k) => ({
            userId: k.userId,
            name: k.displayname || k.userId,
            events: { member: { getContent: () => ({ membership: 'knock', reason: k.reason || '' }) } },
          }))
        : [],
    };
    return {
      on: emitter.on.bind(emitter),
      off: emitter.off.bind(emitter),
      removeListener: emitter.off.bind(emitter),
      _emit: emitter.emit.bind(emitter),
      startClient: async () => {
        // matrix-js-sdk normally fires 'sync' -> 'PREPARED' once initial sync
        // completes. The MatrixClient wrapper waits for that to flip to
        // CONNECTED status.
        setTimeout(() => emitter.emit('sync', 'PREPARED'), 0);
      },
      stopClient: async () => {},
      getCapabilities: async () => ({ 'm.room_versions': { default: '11', available: { 11: 'stable' } } }),
      getRoom: () => fakeRoom,
      roomState: async (roomId) => {
        const m = stateEventsByRoom.get(roomId) || new Map();
        return Array.from(m.values());
      },
      sendStateEvent: async (roomId, type, content, stateKey = '') => {
        if (!stateEventsByRoom.has(roomId)) stateEventsByRoom.set(roomId, new Map());
        const key = `${type}::${stateKey ?? ''}`;
        const event = {
          type,
          state_key: stateKey ?? '',
          content,
          event_id: `$fake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          origin_server_ts: Date.now(),
          sender: cfg().userId,
          room_id: roomId,
        };
        putStateEvent(stateEventsByRoom.get(roomId), key, event);
        recordSend({ kind: 'state', room_id: roomId, type, state_key: event.state_key, content });
        return { event_id: event.event_id };
      },
      sendEvent: async (roomId, type, content) => {
        recordSend({ kind: 'room', room_id: roomId, type, content });
        return { event_id: `$fake-room-${Date.now()}` };
      },
      redactEvent: async () => ({ event_id: `$fake-redact-${Date.now()}` }),
      invite: async (roomId, userId) => {
        recordSend({ kind: 'invite', room_id: roomId, user_id: userId });
        setCfg({ knocks: cfg().knocks.filter((k) => k.userId !== userId) });
        emitter.emit('RoomState.events', memberStateEvent(userId, 'invite'));
        return {};
      },
      kick: async (roomId, userId, reason) => {
        recordSend({ kind: 'kick', room_id: roomId, user_id: userId, reason });
        setCfg({ knocks: cfg().knocks.filter((k) => k.userId !== userId) });
        emitter.emit('RoomState.events', memberStateEvent(userId, 'leave', { reason }));
        return {};
      },
      ban: async () => {},
      setDisplayName: async () => {},
      uploadContent: async () => ({ content_uri: 'mxc://fake/upload' }),
      getProfileInfo: async () => ({ displayname: cfg().displayName }),
      joinRoom: async (id) => ({ roomId: id }),
      leave: async () => {},
      isLoggedIn: () => true,
      getUserId: () => cfg().userId,
    };
  }

  class FakeMatrixClient {
    // ── Static auth surface (called via app.MatrixClient.X) ──────────────
    static async discoverHomeserver(hs) { return hs || HOMESERVER; }
    // Matches the real static: a bare flows array (AuthScreen calls
    // flows.some(...)). Configurable so the SSO-discovery spec can
    // advertise m.login.sso.
    static async getLoginFlows() {
      return cfg().loginFlows;
    }
    static async login(hs, _user, _pass) {
      const rejection = cfg().loginError;
      if (rejection) throw Object.assign(new Error(rejection.message || 'login failed'), rejection);
      return { access_token: ACCESS_TOKEN, user_id: cfg().userId, device_id: 'PLAYWRIGHT', home_server: hs };
    }
    static async loginWithToken(hs, _token) {
      return { access_token: ACCESS_TOKEN, user_id: cfg().userId, device_id: 'PLAYWRIGHT', home_server: hs };
    }
    static async loginWithSSOToken(hs, _token) {
      return { access_token: ACCESS_TOKEN, user_id: cfg().userId, device_id: 'PLAYWRIGHT', home_server: hs };
    }
    static getSSORedirectURL(hs, cb) { return `${hs}/_matrix/client/v3/login/sso/redirect?redirectUrl=${encodeURIComponent(cb)}`; }

    // UIA registration. Config override: cfg().register = { flows,
    // params, token }. Stage completion accrues per page in
    // window.__VTT_E2E_REGISTER so a spec can walk multi-round flows.
    static async register(_hs, body) {
      const reg = cfg().register || {
        flows: [{ stages: ['m.login.registration_token', 'm.login.terms'] }],
        params: {
          'm.login.terms': {
            policies: {
              privacy: { version: '1', en: { name: 'Privacy Policy', url: 'https://fake.matrix.test/privacy' } },
            },
          },
        },
        token: 'LETMEIN',
      };
      const store = (window.__VTT_E2E_REGISTER = window.__VTT_E2E_REGISTER || { completed: [] });
      const stages = reg.flows[0].stages;
      const auth = body && body.auth;
      if (auth && auth.session === 'fake-reg-session' && stages.includes(auth.type) && !store.completed.includes(auth.type)) {
        if (auth.type !== 'm.login.registration_token' || auth.token === reg.token) {
          store.completed.push(auth.type);
        }
      }
      if (body && body.username && stages.every((st) => store.completed.includes(st))) {
        recordSend({ kind: 'register', username: body.username });
        return {
          done: true,
          credentials: {
            user_id: `@${body.username}:fake.matrix.test`,
            access_token: ACCESS_TOKEN,
            device_id: 'PLAYWRIGHT',
          },
        };
      }
      return {
        done: false,
        uia: {
          session: 'fake-reg-session',
          flows: reg.flows,
          params: reg.params,
          completed: store.completed.slice(),
        },
      };
    }

    static async requestRegisterEmailToken(_hs, email, _secret, sendAttempt) {
      recordSend({ kind: 'register-email-token', email, send_attempt: sendAttempt });
      return { sid: 'fake-sid' };
    }

    // ── Constructor + instance surface ───────────────────────────────────
    constructor({ homeserver, accessToken, userId }) {
      this.homeserver = homeserver;
      this.accessToken = accessToken;
      this.userId = userId;
      // Lowercase to match CLIENT_STATUS in src/client/MatrixClient.js.
      // YjsMatrixTransport gates every outbound push on
      // `status === 'connected'`; the old uppercase strings silently
      // buffered all updates and nothing ever went out over the fake.
      this.status = 'disconnected';
      this._statusListeners = new Set();
      // Per-instance state store keyed by roomId -> Map(key -> event).
      // Seeded once from window.__VTT_E2E_CONFIG.initialState if provided.
      this._stateByRoom = new Map();
      const c = cfg();
      if (
        (Array.isArray(c.initialState) && c.initialState.length > 0) ||
        c.yjsSnapshot
      ) {
        const initMap = new Map();
        if (Array.isArray(c.initialState)) {
          for (const e of c.initialState) {
            initMap.set(`${e.type}::${e.state_key ?? ''}`, {
              ...e,
              sender: e.sender || c.userId,
              room_id: e.room_id || c.roomId,
            });
          }
        }
        // Post-Yjs-migration, the syncer's only entity source on join is
        // `com.matrixvtt.yjs.snapshot` (see src/state/yjsSnapshot.js).
        // Raw `com.vtt.<entity>` events are stored for any spec that
        // reads them directly, but the snapshot blob is what actually
        // hydrates sm.characters / sm.npcs / sm.tokens. The fixture
        // builds the snapshot from initialState in logged-in.js.
        if (c.yjsSnapshot) {
          initMap.set('com.matrixvtt.yjs.snapshot::', {
            type: 'com.matrixvtt.yjs.snapshot',
            state_key: '',
            sender: c.userId,
            room_id: c.roomId,
            content: { data: c.yjsSnapshot, marker: Date.now() },
          });
        }
        this._stateByRoom.set(c.roomId, initMap);
      }
      this.sdk = makeFakeSdk(this._stateByRoom);
      // Specs push live membership changes (e.g. an incoming knock)
      // through the same RoomState.events path the real sdk uses.
      window.__VTT_E2E_EMIT_MEMBER_EVENT = (userId, membership, extra = {}) => {
        if (membership === 'knock') {
          setCfg({
            knocks: cfg().knocks.filter((k) => k.userId !== userId).concat([{
              userId,
              displayname: extra.displayname || '',
              reason: extra.reason || '',
            }]),
          });
        }
        this.sdk._emit('RoomState.events', memberStateEvent(userId, membership, extra));
      };
    }

    onStatusUpdate(cb) {
      this._statusListeners.add(cb);
      cb(this.status);
      return () => this._statusListeners.delete(cb);
    }
    _setStatus(s) {
      this.status = s;
      for (const cb of this._statusListeners) cb(s);
    }

    async start() {
      this._setStatus('connecting');
      await this.sdk.startClient();
      // Mimic the real client's sync -> connected flip.
      this._setStatus('connected');
    }
    async stop() {
      await this.sdk.stopClient();
      this._setStatus('disconnected');
    }

    async sendVTTEvent(roomId, type, stateKey, content) {
      if (stateKey === null || stateKey === undefined) {
        return this.sdk.sendEvent(roomId, type, content);
      }
      return this.sdk.sendStateEvent(roomId, type, content, stateKey);
    }

    async getProfile() { return { displayname: cfg().displayName }; }
    // Real MatrixClient wraps `sdk.getJoinedRooms()` and unwraps the
    // `joined_rooms` field - callers see a plain array.
    async getJoinedRooms() { return [cfg().roomId]; }
    async getInvitedRooms() { return []; }
    async getRoomName(roomId) { return roomId === cfg().roomId ? cfg().roomName : roomId; }
    async getVttState(roomId) {
      const m = this._stateByRoom.get(roomId);
      if (!m) return {};
      const out = {};
      for (const [k, v] of m) out[k] = v.content;
      return out;
    }
    async getRoomState(roomId) {
      const m = this._stateByRoom.get(roomId);
      return m ? Array.from(m.values()) : [];
    }
    async getRoomMembers() { return [{ userId: cfg().userId, displayname: cfg().displayName, membership: 'join' }]; }
    async resolveRoomAlias(alias) { return alias.startsWith('#') ? cfg().roomId : alias; }
    async joinRoom(idOrAlias) { return idOrAlias.startsWith('#') ? cfg().roomId : idOrAlias; }
    async leaveRoom() { return {}; }
    async sync(_since, timeoutMs = 0) {
      // Real /sync long-polls for `timeout` ms. Resolving instantly
      // spun the discovery screen's invite poller into a hot loop
      // that froze the page; wait a bounded slice instead.
      await new Promise((r) => setTimeout(r, Math.min(timeoutMs || 50, 1000)));
      return { next_batch: 's_fake', rooms: { invite: {}, join: {}, leave: {} } };
    }
    async createRoom(name) {
      const id = `!fake-${Date.now()}:fake.matrix.test`;
      setCfg({ roomId: id, roomName: name });
      recordSend({ kind: 'createRoom', room_id: id, name });
      return id;
    }
  }

  window.__VTT_E2E_MATRIX_CLIENT_CLASS = FakeMatrixClient;
})();
