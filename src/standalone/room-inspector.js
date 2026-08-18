/**
 * room-inspector.js - dev-only diagnostic panel for the discovery screen.
 *
 * Lets a developer query a room (by ID or alias) and see exactly which
 * state events live there. Buckets by com.vtt.* live / ghost / non-VTT so
 * "leftover data" reports can be verified at source.
 *
 * Gated by `import.meta.env.DEV` at the call site - Vite strips this
 * module from prod bundles via dead-code elimination on the guard.
 */

import { escapeHtml } from './app-log.js';

/**
 * Fetch a room's full state and bucket by VTT / non-VTT / ghost.
 *
 * @param {object} client - MatrixClient with getRoomState, getRoomName, etc.
 * @param {string} idOrAlias - room ID (!opaque:server) or alias (#name:server)
 * @returns {Promise<{
 *   roomId: string, name: string, isJoined: boolean, isGM: boolean,
 *   summary: { vttLive: Record<string, number>, vttGhost: Record<string, number>, nonVtt: Record<string, number> },
 *   foreignCursors: Array<{state_key: string}>,
 *   events: Array,
 * }>}
 */
export async function inspectRoom(client, idOrAlias) {
  const trimmed = String(idOrAlias).trim();
  const roomId = trimmed.startsWith('#') ? await client.resolveRoomAlias(trimmed) : trimmed;

  const [events, name, joinedRooms] = await Promise.all([
    client.getRoomState(roomId),
    client.getRoomName(roomId).catch(() => roomId),
    client.getJoinedRooms().catch(() => []),
  ]);

  const summary = { vttLive: {}, vttGhost: {}, nonVtt: {} };
  const foreignCursors = [];
  for (const e of (events || [])) {
    const isVtt = typeof e.type === 'string' && e.type.startsWith('com.vtt.');
    const isEmpty = !e.content || Object.keys(e.content).length === 0;
    const bucket = !isVtt ? summary.nonVtt : isEmpty ? summary.vttGhost : summary.vttLive;
    bucket[e.type] = (bucket[e.type] ?? 0) + 1;
    // Track foreign user-keyed events separately - these are the ones that
    // trip the 403 on delete-session because only the owning user can
    // overwrite their own state_key.
    if (isVtt && typeof e.state_key === 'string'
        && e.state_key.startsWith('@') && e.state_key.includes(':')
        && e.state_key !== client.userId) {
      foreignCursors.push({ type: e.type, state_key: e.state_key });
    }
  }

  const settingsEvent = (events || []).find(
    (e) => e.type === 'com.vtt.settings' && e.state_key === ''
  );
  const gmList = settingsEvent?.content?.gm_user_ids ?? [];
  const isGM = Array.isArray(gmList) && gmList.includes(client.userId);

  return {
    roomId,
    name,
    isJoined: joinedRooms.includes(roomId),
    isGM,
    summary,
    foreignCursors,
    events: events || [],
  };
}

/**
 * Mount the inspector UI into a container. Wires the submit button; on
 * submit runs inspectRoom against `app.auth.client` and renders the
 * result into the panel. Safe to call multiple times - replaces prior
 * content.
 */
export function renderInspectorPanel(app, container) {
  container.innerHTML = `
    <div class="section-heading" style="margin-top: 24px;">
      🔧 Dev: Inspect Room
    </div>
    <div class="inspector-panel" style="background: var(--color-background-secondary); border: 1px solid var(--color-border-primary); border-radius: var(--border-radius-lg); padding: var(--space-xl);">
      <div style="display: flex; gap: var(--space-sm);">
        <input id="inspect-room-input" class="form-input" type="text"
               aria-label="Room ID or alias to inspect"
               placeholder="!room:server or #alias:server" autocomplete="off" style="flex: 1;">
        <button class="dbt btn-secondary" id="inspect-btn">Inspect</button>
      </div>
      <div id="inspect-error" class="auth-error" role="alert" style="margin-top: var(--space-sm);"></div>
      <div id="inspect-results" style="margin-top: var(--space-md);"></div>
    </div>
  `;

  const input = container.querySelector('#inspect-room-input');
  const btn = container.querySelector('#inspect-btn');
  const errEl = container.querySelector('#inspect-error');
  const resultsEl = container.querySelector('#inspect-results');

  const run = async () => {
    const val = input.value.trim();
    if (!val) return;
    errEl.textContent = '';
    errEl.classList.remove('visible');
    resultsEl.innerHTML = '<div style="padding: var(--space-md); color: var(--color-text-secondary);">Loading…</div>';
    btn.disabled = true;
    try {
      const report = await inspectRoom(app.auth.client, val);
      resultsEl.innerHTML = _formatReport(report);
      _wireUpgradeButton(app, resultsEl, report);
    } catch (err) {
      resultsEl.innerHTML = '';
      errEl.textContent = `${err?.errcode || 'Error'}: ${err?.message || String(err)}`;
      errEl.classList.add('visible');
    } finally {
      btn.disabled = false;
    }
  };

  btn.addEventListener('click', run);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
}

function _wireUpgradeButton(app, resultsEl, report) {
  const btn = resultsEl.querySelector('#inspect-upgrade-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const ok = window.confirm(
      `Upgrade "${report.name}" to a clean new room?\n\n` +
      `• Synapse will create a new room and migrate members, power levels, name.\n` +
      `• All ${Object.values(report.summary.vttGhost).reduce((a, b) => a + b, 0)} tombstoned VTT events will NOT be carried over - the new room starts empty.\n` +
      `• The old room gets a tombstone pointer; clients follow it automatically.\n` +
      `• You must have 'create' power (usually 100) in the old room.\n\n` +
      `This is irreversible. Proceed?`
    );
    if (!ok) return;
    btn.disabled = true;
    btn.textContent = 'Upgrading…';
    try {
      const newRoomId = await app.auth.client.upgradeRoom(report.roomId);
      resultsEl.insertAdjacentHTML('afterbegin', `
        <div style="padding: var(--space-md); margin-bottom: var(--space-md); background: color-mix(in srgb, var(--color-text-success) 12%, transparent); border: 1px solid var(--color-text-success); border-radius: var(--border-radius-sm); color: var(--color-text-success); font-size: var(--font-size-sm);">
          ✅ <strong>Room upgraded.</strong> New room: <code>${escapeHtml(newRoomId)}</code>. Joining members will be migrated by their clients automatically. Paste the new room ID into "New Session" to enter it.
        </div>
      `);
      btn.remove();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Upgrade room to clean state';
      alert(`Upgrade failed: ${err?.errcode || ''} ${err?.message || err}`);
    }
  });
}

function _formatReport(r) {
  const { roomId, name, isJoined, isGM, summary, foreignCursors, events } = r;
  const totalLive = _sum(summary.vttLive);
  const totalGhost = _sum(summary.vttGhost);
  const totalNon = _sum(summary.nonVtt);

  // "Impactful" live state = anything other than presence-shaped events
  // (cursor). The client never reads cursor events, so a room with *only*
  // cursor live events is effectively clean - the GM can rejoin without
  // the wizard surfacing leftover data.
  const impactfulLive = Object.entries(summary.vttLive).reduce(
    (n, [t, c]) => t === 'com.vtt.cursor' ? n : n + c, 0
  );
  const statusBanner = impactfulLive === 0
    ? `<div style="padding: var(--space-md); margin-bottom: var(--space-md); background: color-mix(in srgb, var(--color-text-success) 12%, transparent); border: 1px solid var(--color-text-success); border-radius: var(--border-radius-sm); color: var(--color-text-success); font-size: var(--font-size-sm);">
         ✅ <strong>Room is effectively clean.</strong> No live VTT state from this client's perspective.${totalGhost ? ` (${totalGhost} tombstoned events remain on the server but do not affect sessions.)` : ''}
       </div>`
    : `<div style="padding: var(--space-md); margin-bottom: var(--space-md); background: color-mix(in srgb, var(--color-text-warning) 12%, transparent); border: 1px solid var(--color-text-warning); border-radius: var(--border-radius-sm); color: var(--color-text-warning); font-size: var(--font-size-sm);">
         ⚠ <strong>Room has ${impactfulLive} live VTT event${impactfulLive === 1 ? '' : 's'}.</strong> Rejoining will load this state into your client.
       </div>`;

  const foreign = foreignCursors.length
    ? `<div style="margin-top: var(--space-sm); padding: var(--space-sm); background: var(--color-background-tertiary); border-radius: var(--border-radius-sm); font-size: var(--font-size-xs); color: var(--color-text-secondary);">
         <strong>ℹ️ ${foreignCursors.length} event${foreignCursors.length === 1 ? '' : 's'} owned by other user${foreignCursors.length === 1 ? '' : 's'}:</strong>
         <code style="word-break: break-all;">${foreignCursors.slice(0, 5).map(f => escapeHtml(`${f.type}#${f.state_key}`)).join(', ')}${foreignCursors.length > 5 ? '…' : ''}</code>
         <div style="margin-top: var(--space-xs);">Only the owning user can tombstone these. Harmless - the current client doesn't read <code>com.vtt.cursor</code>. Future sessions in this room are unaffected.</div>
       </div>`
    : '';

  return `
    ${statusBanner}
    <div>
      <div style="font-weight: 600; font-size: var(--font-size-md);">${escapeHtml(name)}</div>
      <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); word-break: break-all;">${escapeHtml(roomId)}</div>
      <div style="font-size: var(--font-size-xs); margin-top: var(--space-xs);">
        Membership: ${isJoined ? '<span style="color:var(--color-text-success);">joined</span>' : '<span style="color:var(--color-text-tertiary);">not joined</span>'}
        &nbsp;•&nbsp; GM: ${isGM ? '<span style="color:var(--color-text-success);">yes</span>' : '<span style="color:var(--color-text-tertiary);">no</span>'}
      </div>
    </div>

    <div style="margin-top: var(--space-md);">
      <div style="font-size: var(--font-size-sm); font-weight: 600;">Live VTT state (${totalLive})</div>
      ${_rowList(summary.vttLive) || '<div style="color:var(--color-text-tertiary); font-size:var(--font-size-xs);">(none)</div>'}
    </div>

    ${foreign}

    <details style="margin-top: var(--space-md);">
      <summary style="cursor: pointer; font-size: var(--font-size-sm); font-weight: 600;">
        Tombstoned VTT state (${totalGhost})
        <span style="font-weight: normal; color: var(--color-text-tertiary); font-size: var(--font-size-xs);">- deleted, won't affect rejoin</span>
      </summary>
      ${_rowList(summary.vttGhost) || '<div style="color:var(--color-text-tertiary); font-size:var(--font-size-xs); margin-top: var(--space-xs);">(none)</div>'}
      ${totalGhost > 0 ? `
        <div style="margin-top: var(--space-md); padding: var(--space-sm); background: var(--color-background-tertiary); border-radius: var(--border-radius-sm); font-size: var(--font-size-xs); color: var(--color-text-secondary); line-height: 1.5;">
          <strong>Why these linger:</strong> Matrix's <code>/state</code> endpoint keeps every <code>(type, state_key)</code> pair ever written, even when content is emptied. Individual state events cannot be deleted - that's a Matrix design choice, not a bug in this app.
          <br><br>
          <strong>The only way to remove them</strong> is a <em>room upgrade</em>: Synapse creates a replacement room with essential <code>m.room.*</code> state only (name, members, power levels) and tombstones this one. Custom <code>com.vtt.*</code> events are <em>not</em> carried over. Members follow the tombstone pointer automatically.
          <br><br>
          <button class="dbt btn-secondary" id="inspect-upgrade-btn" style="margin-top: var(--space-xs);">Upgrade room to clean state</button>
        </div>
      ` : ''}
    </details>

    <details style="margin-top: var(--space-md);">
      <summary style="cursor: pointer; font-size: var(--font-size-sm); font-weight: 600;">
        Non-VTT state (${totalNon})
        <span style="font-weight: normal; color: var(--color-text-tertiary); font-size: var(--font-size-xs);">- Matrix housekeeping</span>
      </summary>
      ${_rowList(summary.nonVtt) || '<div style="color:var(--color-text-tertiary); font-size:var(--font-size-xs); margin-top: var(--space-xs);">(none)</div>'}
    </details>

    <details style="margin-top: var(--space-md);">
      <summary style="cursor: pointer; color: var(--color-text-secondary); font-size: var(--font-size-xs);">Raw JSON (${events.length} events)</summary>
      <pre style="margin-top: var(--space-sm); padding: var(--space-sm); background: var(--color-background-tertiary); border-radius: var(--border-radius-sm); font-size: var(--font-size-xs); max-height: 360px; overflow: auto;">${escapeHtml(JSON.stringify(events, null, 2))}</pre>
    </details>
  `;
}

function _rowList(counts) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return '';
  return `
    <div style="font-size: var(--font-size-xs); font-family: monospace; margin-top: var(--space-xs);">
      ${entries.map(([t, n]) => `<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>${escapeHtml(t)}</span><span>${n}</span></div>`).join('')}
    </div>
  `;
}

function _sum(counts) {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}
