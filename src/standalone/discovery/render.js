/**
 * render.js - imperative mount points for the discovery screen's
 * three card sections (recent, invites, active). Card markup itself
 * is Preact (`DiscoveryCards.jsx`); this file owns the
 * element-swap + empty-state toggles that drive it.
 */

import { removeRecentSession } from '../sessionStore.js';
import {
  renderInviteList, renderRecentList, renderActiveList,
} from '../DiscoveryCards.jsx';
import { confirmAndEnterRoom } from './room-preview.js';
import { confirmed } from '../../ui/confirm-dialogs.jsx';

export async function renderPendingInvites(app, client) {
  const list = app.doc.getElementById('invites-list');
  const heading = app.doc.getElementById('invites-heading');
  if (!list || !heading) return;

  const invites = await client.getInvitedRooms();
  if (invites.length === 0) {
    heading.style.display = 'none';
    list.replaceChildren();
    return;
  }
  heading.style.display = '';
  renderInviteList(list, invites, {
    accept: async (inv) => {
      try { await confirmAndEnterRoom(app, inv.roomId, inv.name); }
      catch (err) { app.setError('discovery-error', `Failed to accept invite: ${err.message}`); }
    },
    decline: async (inv) => {
      if (!(await confirmed(`Decline invite to "${inv.name}"?`, { title: 'Decline invite', confirmText: 'Decline', confirmClass: 'dbt--danger' }))) return;
      try {
        await client.leaveRoom(inv.roomId);
        await app.loadDiscovery();
      } catch (err) {
        app.setError('discovery-error', `Failed to decline invite: ${err.message}`);
      }
    },
  });
}

export function renderRecentSessions(app, recentSessions, scanResults = []) {
  const recentList = app.doc.getElementById('recent-list');
  const emptyEl = app.doc.getElementById('recent-empty');
  if (!recentList || !emptyEl) return;

  // A brand-new account should see ONE empty voice (Active Sessions),
  // not a Recent Sessions heading with a Clear All for nothing.
  const heading = app.doc.getElementById('recent-heading');
  if (heading) heading.style.display = recentSessions.length === 0 ? 'none' : 'flex';
  emptyEl.style.display = 'none';

  // Stored roomName can be a room id (manual paste, or a join before any
  // m.room.name / com.vtt.settings.name was set). Prefer the freshest
  // server-side name when the scan saw the room.
  const byId = new Map(scanResults.map((r) => [r.id, r]));
  const enriched = recentSessions.map((s) => {
    const scan = byId.get(s.roomId);
    const niceName = scan?.vttState?.name || scan?.name || s.roomName || s.roomId;
    return { ...s, roomName: niceName };
  });

  renderRecentList(recentList, enriched, {
    resume: (s) => {
      app.appLog.add('info', `🟢 Resume tapped roomId=${s.roomId} ua=${(navigator.userAgent || '').slice(0, 60)}`);
      return confirmAndEnterRoom(app, s.roomId, s.roomName);
    },
    remove: async (s) => {
      removeRecentSession(s.userId, s.roomId);
      await app.loadDiscovery();
    },
  });
}

export function renderActiveSessions(app, totalRooms, results) {
  const hasVtt = (r) => r.vttState !== null && Object.keys(r.vttState).length > 0;
  const activeSessions = results.filter(hasVtt);
  const otherRooms = results.filter((r) => !hasVtt(r));
  const activeList = app.doc.getElementById('active-list');
  const emptyEl = app.doc.getElementById('active-empty');
  if (!activeList || !emptyEl) return;

  // Always reflect the "other rooms" expansion state, regardless of
  // whether Active Sessions is empty - the user with zero VTT rooms
  // benefits from this list most.
  renderOtherJoinedRooms(app, otherRooms);

  if (totalRooms === 0) {
    emptyEl.textContent =
      'No joined Matrix rooms yet. Create a room below to run a game as the GM, or join with an invite link.';
    emptyEl.style.display = 'block';
    activeList.replaceChildren();
    return;
  }
  if (activeSessions.length === 0) {
    emptyEl.textContent =
      'You have joined rooms, but none currently contain MatrixVTT session state.';
    emptyEl.style.display = 'block';
    activeList.replaceChildren();
    return;
  }
  emptyEl.style.display = 'none';

  const displayName = (r) => r.vttState?.name || r.name || r.id;
  renderActiveList(activeList, activeSessions, {
    join: (r) => confirmAndEnterRoom(app, r.id, displayName(r)),
    leave: async (r) => {
      if (!(await confirmed(`Leave Matrix room "${displayName(r)}"?`, { title: 'Leave room', confirmText: 'Leave', confirmClass: 'dbt--danger' }))) return;
      try {
        await app.auth.client.leaveRoom(r.id);
        removeRecentSession(app.auth.userId, r.id);
        await app.loadDiscovery();
      } catch (err) {
        app.setError('discovery-error', 'Failed to leave room: ' + err.message);
      }
    },
  });
}

function renderOtherJoinedRooms(app, otherRooms) {
  const toggle = app.doc.getElementById('other-rooms-toggle');
  const list = app.doc.getElementById('other-list');
  if (!toggle || !list) return;

  const fresh = toggle.cloneNode(true);
  toggle.parentNode.replaceChild(fresh, toggle);

  if (otherRooms.length === 0) {
    fresh.style.display = 'none';
    list.style.display = 'none';
    list.replaceChildren();
    return;
  }

  fresh.style.display = '';
  fresh.textContent = `Show all joined rooms (${otherRooms.length})`;
  list.style.display = 'none';
  list.replaceChildren();

  const displayName = (r) => r.name || r.id;
  fresh.addEventListener('click', () => {
    const expanded = list.style.display !== 'none';
    if (expanded) {
      list.style.display = 'none';
      list.replaceChildren();
      fresh.textContent = `Show all joined rooms (${otherRooms.length})`;
      return;
    }
    list.style.display = 'block';
    renderActiveList(list, otherRooms, {
      join: (r) => confirmAndEnterRoom(app, r.id, displayName(r)),
      leave: async (r) => {
        if (!(await confirmed(`Leave Matrix room "${displayName(r)}"?`, { title: 'Leave room', confirmText: 'Leave', confirmClass: 'dbt--danger' }))) return;
        try {
          await app.auth.client.leaveRoom(r.id);
          removeRecentSession(app.auth.userId, r.id);
          await app.loadDiscovery();
        } catch (err) {
          app.setError('discovery-error', 'Failed to leave room: ' + err.message);
        }
      },
    });
    fresh.textContent = `Hide joined rooms (${otherRooms.length})`;
  });
}
