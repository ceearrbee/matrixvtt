/**
 * StandaloneApp - orchestrator for the non-widget entry point.
 *
 * Owns DOM wiring, the lifecycle state machine (login → discovery → vtt),
 * and the persisted-session restore path. All heavy lifting lives in
 * sibling modules (auth/room-discovery/session/app-log).
 */

import { MatrixClient } from '../client/MatrixClient.js';
import { VTT_EVENTS } from '../utils/constants.js';
import { removeRecentSession } from './sessionStore.js';
import { createAppLog } from './app-log.js';
import {
  finishSSOLogin,
  startSSOLogin,
  recoverInFlightHomeserver,
  resolveSSOHomeserver,
} from './auth.js';
import { describeAuthError } from './auth-errors.js';
import { loadDiscovery } from './room-discovery.js';
import {
  enterRoom,
  handleCreateRoom,
  handleFactoryReset,
  leaveRoom,
  returnToRoomList,
  startVTT,
} from './session.js';
import { mountStandaloneShell } from './StandaloneShell.jsx';

export class StandaloneApp {
  constructor({
    doc = document,
    win = window,
    history = window.history,
    location = window.location,
    container = document.body,
    matrixClientClass = MatrixClient,
    matrixVTTClient = window.matrixVTTClient,
  } = {}) {
    this.doc = doc;
    this.win = win;
    this.history = history;
    this.location = location;
    this.container = container;
    this.MatrixClient = matrixClientClass;
    this.matrixVTTClient = matrixVTTClient;

    this.auth = null;
    this.currentSession = null;
    this.scanCancelled = false;
    this.inviteAbort = null;
    this.resolvedHs = null;
    this.appLog = createAppLog(doc, win);

    this._uiBound = false;
    this._disposers = [];

    this.leaveRoom = () => leaveRoom(this);
    this.returnToRoomList = () => returnToRoomList(this);
  }

  async bootstrap() {
    this.bindUI();

    mountStandaloneShell(this.container, this);

    const urlParams = new URLSearchParams(this.location.search);
    const loginToken = urlParams.get('loginToken');
    const ssoHs = urlParams.get('hs');

    if (loginToken) {
      this.history.replaceState({}, '', this.location.pathname);
      // Trust only the homeserver we stashed in sessionStorage before
      // the redirect; the URL `?hs=` parameter is attacker-controllable
      // and is accepted only when it matches the stashed value.
      const recoveredHs = resolveSSOHomeserver(ssoHs, recoverInFlightHomeserver());
      if (recoveredHs) {
        await finishSSOLogin(this, recoveredHs, loginToken);
        return;
      }
      this.showScreen('login');
      this.setLoginError(
        'Could not finish single sign-on: the homeserver wasn\'t saved before redirect. Please sign in again.',
      );
      return;
    }
  }

  // Auth restore is now handled by StandaloneShell's useEffect
  async restoreSession() {}

  showScreen(_name) {
    // Overridden by StandaloneShell at mount time.
  }

  completeLogin(_auth) {
    // Overridden by StandaloneShell at mount time.
  }

  setLoginError(_msg) {
    // Overridden by StandaloneShell at mount time.
  }

  setError(elId, msg, _retried = false) {
    const el = this.doc.getElementById(elId);
    if (!el) {
      // Callers often switch screens and set the error in the same
      // breath; the Preact screen (and its error element) mounts a
      // tick later. One retry bridges that gap instead of dropping
      // the message on the floor.
      if (!_retried) setTimeout(() => this.setError(elId, msg, true), 100);
      return;
    }
    el.textContent = msg;
    el.classList.toggle('visible', !!msg);
  }

  bindUI() {
    if (this._uiBound) return;
    this._uiBound = true;

    const on = (target, type, handler) => {
      target?.addEventListener(type, handler);
      this._disposers.push(() => target?.removeEventListener(type, handler));
    };

    on(this.win, VTT_EVENTS.LEAVE_ROOM, this.leaveRoom);
    on(this.win, VTT_EVENTS.RETURN_TO_ROOMS, this.returnToRoomList);

    const onDeleteSession = async () => {
      try { await this.matrixVTTClient?.state?.awaitQueueDrain?.(5000); } catch { /* ignore */ }
      this.matrixVTTClient?.destroy();
      if (this.currentSession) {
        removeRecentSession(this.currentSession.userId, this.currentSession.roomId);
      }
      this.currentSession = null;
      this.showScreen('discovery');
    };
    on(this.win, VTT_EVENTS.DELETE_SESSION, onDeleteSession);
  }

  destroy() {
    for (const dispose of this._disposers) {
      try { dispose(); } catch { /* ignore */ }
    }
    this._disposers = [];
    this._uiBound = false;
  }

  loadDiscovery() { return loadDiscovery(this); }
  enterRoom(roomId, name, forceWizard = false) { return enterRoom(this, roomId, name, forceWizard); }
  startVTT(session, forceWizard = false) { return startVTT(this, session, forceWizard); }
  handleCreateRoom() { return handleCreateRoom(this); }
  handleFactoryReset() { return handleFactoryReset(this); }
  startSSOLogin() { return startSSOLogin(this); }
  getAuthErrorMessage(err, opts) { return describeAuthError(err, opts); }
}

export function bootstrapStandaloneApp(options = {}) {
  const app = new StandaloneApp(options);
  app.bootstrap();
  return app;
}
