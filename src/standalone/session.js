/**
 * Room/session lifecycle actions for the standalone client.
 *
 * Each function mutates the StandaloneApp instance (`app`) and the Matrix VTT
 * client. Persistence is delegated to sessionStore.
 */

import { h, render } from 'preact';
import { logger } from '../utils/logger.js';
import { upsertRecentSession, removeRecentSession, saveActiveRoom } from './sessionStore.js';
import { describeAuthError } from './auth-errors.js';
import { isConnectionLostError } from '../utils/connection-error.js';
import { ConnectionLost } from '../ui/ConnectionLost.jsx';
import { MatrixClient } from '../client/MatrixClient.js';
import { confirmed, confirmTyped } from '../ui/confirm-dialogs.jsx';
import { promptKnock } from './KnockDialog.jsx';

export async function enterRoom(app, roomIdOrAlias, roomName, forceWizard = false, via = []) {
  app.appLog.add('info', `→ enterRoom ${roomIdOrAlias} forceWizard=${forceWizard}`);

  // Join the room if we're not already a member. The /join endpoint resolves
  // both room IDs and aliases, and accepts a pending invite if one exists.
  // On success it returns the canonical room_id; on failure it surfaces the
  // homeserver error (403 M_FORBIDDEN for private rooms without an invite,
  // 404 M_NOT_FOUND for bad IDs, 429 for rate limits) - we translate those
  // into human-readable copy before surfacing to the discovery screen.
  let roomId = roomIdOrAlias;
  let justJoined = false;
  try {
    const joined = await app.auth.client.getJoinedRooms();
    const isJoined = joined.includes(roomIdOrAlias);
    if (!isJoined) {
      app.appLog.add('info', `  joining ${roomIdOrAlias}`);
      roomId = await app.auth.client.joinRoom(roomIdOrAlias, via);
      justJoined = true;
    }
  } catch (err) {
    const code = err?.errcode || err?.data?.errcode;
    // Distinguish transient network failures from permanent rejection.
    // Without the distinction, a reload on a flaky connection dumps the
    // user to the discovery screen because /joined_rooms or /join
    // momentarily failed - even though the next attempt seconds later
    // would work. Transient errors render the ConnectionLost surface and
    // keep `activeRoom` intact so a Reload Now retries the same room.
    const isTransient =
      !code &&
      (err?.name === 'TypeError' ||
       isConnectionLostError(err) ||
       /network|fetch|timeout/i.test(err?.message ?? ''));
    if (isTransient) {
      logger.warn('StandaloneApp', `enterRoom transient failure: ${err?.message ?? err}`);
      app.appLog.add('error', `✗ rejoin failed (transient): ${err.message}`);
      const host = app.doc.getElementById('app') || app.doc.body;
      render(h(ConnectionLost, { errorMessage: err.message }), host);
      return;
    }

    // Permanent failure path: clear activeRoom so reload doesn't loop
    // on a dead room, then route to discovery.
    saveActiveRoom(null);
    if (code === 'M_FORBIDDEN' && await _tryKnock(app, roomIdOrAlias)) {
      // Knock dispatched - surface the discovery screen so the user sees
      // the "knock sent" status and pending-invites list.
      app.showScreen('discovery');
      return;
    }
    const msg = _describeJoinError(err, roomIdOrAlias);
    app.appLog.add('error', `✗ join failed: ${err.message}`);
    app.showScreen('discovery');
    app.setError('discovery-error', msg);
    return;
  }

  const session = {
    homeserver: app.auth.homeserver,
    userId: app.auth.userId,
    displayName: app.auth.displayName,
    roomId,
    roomName: roomName || roomId,
    lastUsed: Date.now(),
  };
  upsertRecentSession(session);
  await startVTT(app, session, forceWizard || justJoined);
}

/**
 * Offer to knock when a straight join was forbidden. A knock only succeeds
 * if the room's join_rules is `knock` or `knock_restricted`; on other
 * private rooms the homeserver still rejects with M_FORBIDDEN and the
 * caller falls through to the generic error path.
 *
 * Returns true when a knock was sent; false otherwise.
 */
async function _tryKnock(app, idOrAlias) {
  const { ok, reason } = await promptKnock(idOrAlias);
  if (!ok) return false;
  try {
    await app.auth.client.knockRoom(idOrAlias, reason);
    app.appLog.add('info', `✓ knock sent to ${idOrAlias}`);
    app.setError(
      'discovery-error',
      `Knock request sent to ${idOrAlias}. You will see an invite here once a member of the room approves it.`
    );
    return true;
  } catch (err) {
    const code = err?.errcode || err?.data?.errcode;
    if (code === 'M_FORBIDDEN') {
      app.setError('discovery-error', `Knock rejected: ${idOrAlias} does not allow knocks. Ask a member to invite you directly.`);
    } else {
      app.setError('discovery-error', `Knock failed: ${err.message}`);
    }
    return true; // Error was surfaced; don't fall through to the generic message.
  }
}

function _describeJoinError(err, idOrAlias) {
  return describeAuthError(err, { context: 'join', target: idOrAlias });
}

export async function startVTT(app, session, forceWizard = false) {
  app.currentSession = session;
  saveActiveRoom({ roomId: session.roomId, roomName: session.roomName });
  app.showScreen('vtt');

  // Wait for the DOM to flush so #app container exists
  await new Promise(r => requestAnimationFrame(r));
  await new Promise(r => setTimeout(r, 50));

  try {
    if (!app.doc.getElementById('app')) {
       throw new Error('VTT container (#app) not found in DOM after screen switch.');
    }

    await app.matrixVTTClient.initVTT(
      app.auth.homeserver,
      app.auth.accessToken,
      app.auth.userId,
      session.roomId,
      forceWizard
    );
    app.appLog.add('info', `✓ VTT started room=${session.roomId}`);
    // Stamping room-visited belongs to render-policy's non-wizard
    // branch and the wizard's own close handler. Stamping here raced
    // the rAF read in render-policy and could suppress the wizard for
    // the GM who just created the room; a reload mid-wizard on a
    // still-empty room correctly re-offers setup.
  } catch (err) {
    logger.error('StandaloneApp', 'VTT init failed:', err);
    app.appLog.add('error', `✗ VTT init failed: ${err.message}`);

    if (isConnectionLostError(err)) {
      const host = app.doc.getElementById('app') || app.doc.body;
      render(h(ConnectionLost, { errorMessage: err.message }), host);
      return;
    }

    app.showScreen('discovery');
    app.setError('discovery-error', 'Failed to start session: ' + err.message);
  }
}

export async function handleCreateRoom(app) {
  const input = app.doc.getElementById('create-room-input');
  const name = input.value.trim() || 'VTT Session';
  const btn = app.doc.getElementById('create-room-btn');
  const knockable = !!app.doc.getElementById('create-room-knock')?.checked;
  btn.disabled = true;
  btn.textContent = 'Creating…';
  try {
    const initialState = knockable
      ? [{ type: 'm.room.join_rules', state_key: '', content: { join_rule: 'knock' } }]
      : [];
    const roomId = await app.auth.client.createRoom(name, { initialState });
    input.value = '';
    // Seed a minimal com.vtt.settings so the room appears in the
    // discovery screen's Active Sessions list immediately. Without
    // this, a user who created a room but then closed/refreshed
    // before completing the setup wizard ended up with an orphaned
    // Matrix room invisible to MatrixVTT's discovery filter (which
    // requires non-empty com.vtt.settings). Best-effort: a failed
    // seed write is logged but doesn't abort the create flow - the
    try {
      await app.auth.client.sdk.sendStateEvent(
        roomId,
        'com.vtt.settings',
        { name, pending_setup: true },
        '',
      );
    } catch (err) {
      app.appLog.add('warn', `settings seed write failed: ${err.message}`);
    }
    await app.enterRoom(roomId, name, true);
  } catch (err) {
    app.setError('discovery-error', 'Could not create room: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Room';
  }
}

export function handleFactoryReset(app) {
  confirmTyped(
    'Permanently delete all local data? This clears your login session, ' +
    'recent rooms list, and all local settings. Campaign data stored on ' +
    'Matrix servers is NOT deleted.',
    'RESET',
    async () => {
      localStorage.clear();
      sessionStorage.clear();
      // Also drop the SDK's IndexedDB sync store - it survives
      // localStorage.clear() and would otherwise leave the cached
      // timeline behind after a "delete all".
      await MatrixClient.deleteStoreData(app.auth?.userId);
      app.win.location.reload();
    },
    { title: 'Factory reset', confirmText: 'Delete everything' },
  );
}

export async function leaveRoom(app) {
  const session = app.currentSession;
  saveActiveRoom(null);
  if (!session) {
    app.matrixVTTClient?.destroy();
    app.showScreen('discovery');
    return;
  }
  const proceed = await confirmed(`Leave Matrix room "${session.roomName || session.roomId}"?`, {
    title: 'Leave room', confirmText: 'Leave', confirmClass: 'dbt--danger',
  });
  if (!proceed) return;
  app.matrixVTTClient?.destroy();
  try {
    await app.auth.client.leaveRoom(session.roomId);
    removeRecentSession(session.userId, session.roomId);
  } catch (err) {
    app.appLog.add('error', `✗ leave room failed: ${err.message}`);
    removeRecentSession(session.userId, session.roomId);
  }
  app.currentSession = null;
  app.showScreen('discovery');
}
