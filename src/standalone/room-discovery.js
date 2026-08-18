/**
 * room-discovery.js - standalone-mode discovery screen bootstrap.
 *
 * `loadDiscovery` is the single entry point the standalone app
 * reaches from auth / leave / delete-session paths. It sets up the
 * DOM shell, kicks off recent/invite/active rendering, and starts
 * the invite long-poll. All heavy lifting lives in `discovery/`.
 */

import { loadRecentSessions } from './sessionStore.js';
import {
  scanRooms, setScanningLabel, pruneDeletedRecent, SCAN_CONSTANTS,
} from './discovery/scan.js';
import { startInvitePolling, stopInvitePolling } from './discovery/invite-polling.js';
import {
  renderPendingInvites, renderRecentSessions, renderActiveSessions,
} from './discovery/render.js';

export async function loadDiscovery(app) {
  app.appLog.add('info', '← discovery screen');
  const { client, userId, displayName } = app.auth;

  app.scanCancelled = false;
  stopInvitePolling(app);

  // Wait one tick to ensure Preact has rendered the structural IDs
  await new Promise(r => setTimeout(r, 0));

  const getNameEl = () => app.doc.getElementById('discovery-name');
  const getUserIdEl = () => app.doc.getElementById('discovery-userid');
  const getActiveLoadingEl = () => app.doc.getElementById('active-loading');

  if (getNameEl()) getNameEl().textContent = displayName;
  if (getUserIdEl()) getUserIdEl().textContent = userId;
  if (getActiveLoadingEl()) getActiveLoadingEl().style.display = 'flex';

  const cancelBtn = app.doc.getElementById('cancel-scan-btn');
  if (cancelBtn) cancelBtn.style.display = '';

  const activeList = app.doc.getElementById('active-list');
  if (activeList) activeList.replaceChildren();

  const activeEmpty = app.doc.getElementById('active-empty');
  if (activeEmpty) activeEmpty.style.display = 'none';

  app.setError('discovery-error', '');

  const recentSessions = loadRecentSessions().filter((s) => s.userId === app.auth.userId);
  renderRecentSessions(app, recentSessions);

  renderPendingInvites(app, client).catch((err) => {
    app.appLog.add('error', `invites fetch failed: ${err.message}`);
  });
  startInvitePolling(app, client, () => {
    renderPendingInvites(app, client).catch(() => { /* already logged */ });
  });

  try {
    const allRoomIds = [...new Set(await client.getJoinedRooms())];

    // Sort joined rooms by
    // recency before truncating. Without this, a user with > 200
    // rooms might have their actual current campaign land outside
    // the slice window and never appear in the active list. Recent-
    // sessions stored in localStorage carry `lastUsed` timestamps;
    // any room id present there bubbles to the top.
    const recencyMap = new Map(recentSessions.map((s) => [s.roomId, s.lastUsed]));
    const sortedRoomIds = [...allRoomIds].sort((a, b) => {
      const ra = recencyMap.get(a) ?? 0;
      const rb = recencyMap.get(b) ?? 0;
      if (ra !== rb) return rb - ra;
      // Stable secondary order so the slice is deterministic across
      // reloads even when no recents are recorded (e.g. fresh install).
      return a < b ? -1 : a > b ? 1 : 0;
    });

    const roomIds = sortedRoomIds.slice(0, SCAN_CONSTANTS.SCAN_ROOM_LIMIT);
    setScanningLabel(app, allRoomIds.length, roomIds.length);

    const results = await scanRooms(app, client, roomIds);

    if (getActiveLoadingEl()) getActiveLoadingEl().style.display = 'none';
    const survivors = pruneDeletedRecent(recentSessions, results, allRoomIds);
    // Always re-render recent sessions post-scan so the freshly-fetched
    // campaign / room names replace any stored room-id placeholders.
    renderRecentSessions(app, survivors, results);
    renderActiveSessions(app, allRoomIds.length, results);

    // Surface the fallback path when the scan was truncated.
    const truncated = allRoomIds.length - roomIds.length;
    if (truncated > 0) {
      app.setError(
        'discovery-error',
        `Scanned ${roomIds.length} most-recent rooms; ${truncated} more weren't checked. ` +
        `Paste a room ID below to open any room directly.`,
      );
    }
  } catch (err) {
    if (getActiveLoadingEl()) getActiveLoadingEl().style.display = 'none';
    _renderScanFailure(app, err);
  }

  // Dev-only: Vite drops this branch via DCE in production builds.
  if (import.meta.env.DEV) {
    const host = app.doc.getElementById('inspector-host');
    if (host) {
      app.appLog.add('debug', 'Mounting room inspector panel');
      const { renderInspectorPanel } = await import('./room-inspector.js');
      renderInspectorPanel(app, host);
    } else {
      app.appLog.add('warn', 'Could not find #inspector-host to mount dev tools');
    }
  }
}

/**
 * Discovery scan failures get a Retry affordance instead of a
 * static error message. The previous behaviour left the user
 * stranded: scan failed → static "Failed to scan…" toast → only
 * recourse was a full page reload. Most scan failures are flaky
 * homeserver / network issues that resolve on a retry.
 */
function _renderScanFailure(app, err) {
  const errEl = app.doc.getElementById('discovery-error');
  if (!errEl) {
    app.setError('discovery-error', 'Failed to scan rooms from Matrix: ' + err.message);
    return;
  }
  errEl.textContent = '';
  const span = document.createElement('span');
  span.textContent = `Failed to scan rooms: ${err.message}. `;
  errEl.appendChild(span);
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'dbt dbt--sm';
  retry.textContent = 'Retry scan';
  retry.style.marginLeft = '8px';
  retry.addEventListener('click', () => {
    errEl.classList.remove('visible');
    errEl.replaceChildren();
    loadDiscovery(app);
  });
  errEl.appendChild(retry);
  errEl.classList.add('visible');
}
