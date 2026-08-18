
import * as Y from 'yjs';
import { h } from 'preact';
import { useRef, useLayoutEffect } from 'preact/hooks';
import { EVENT_TYPES } from '../../utils/constants.js';
import { Modal } from '../../ui/Modal.jsx';
import { openModal } from '../../ui/modal-host.js';
import { enterRoom } from '../session.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/**
 * Decode a com.matrixvtt.yjs.snapshot state event into a {characters,
 * npcs} projection. Post-Yjs migration, character / npc events no
 * longer live in /state as their own events - they're inside the
 * snapshot blob. Build a throwaway Y.Doc to read them without
 * mutating local state (the user isn't a member yet at preview time).
 */
function _entitiesFromSnapshot(stateArr) {
  const snap = stateArr
    .filter((e) => e.type === 'com.matrixvtt.yjs.snapshot'
      && e?.content?.data
      && typeof e.content.marker === 'number')
    .sort((a, b) => (b.content.marker ?? 0) - (a.content.marker ?? 0))[0];
  if (!snap) return { characters: [], npcs: [] };
  try {
    const bytes = Uint8Array.from(atob(snap.content.data), (c) => c.charCodeAt(0));
    const doc = new Y.Doc();
    Y.applyUpdate(doc, bytes, 'snapshot');
    const characters = [];
    for (const [id, c] of doc.getMap('characters').entries()) {
      characters.push({ id, name: c?.name || id });
    }
    const npcs = [];
    for (const [id, n] of doc.getMap('npcs').entries()) {
      npcs.push({ id, name: n?.name || id });
    }
    doc.destroy();
    return { characters, npcs };
  } catch {
    return { characters: [], npcs: [] };
  }
}

export async function previewRoom(client, idOrAlias) {
  let roomId = idOrAlias;
  if (idOrAlias.startsWith('#')) {
    try {
      roomId = await client.resolveRoomAlias(idOrAlias);
    } catch (err) {
      const code = err?.errcode || err?.data?.errcode;
      return {
        roomId: idOrAlias,
        name: idOrAlias,
        memberCount: 0,
        accessible: false,
        notFound: code === 'M_NOT_FOUND' || code === 'M_UNKNOWN',
        vtt: null,
        characters: [],
        npcs: [],
        joinRule: null,
      };
    }
  }

  // Each endpoint can 403 ("not in room, and previews are disabled") when
  // the user isn't yet a member; fall back to empty results so the preview
  // can still render a "private room - join to see details" panel rather
  // than blowing up the whole flow.
  const [name, vttState, fullState, members] = await Promise.all([
    client.getRoomName(roomId),
    client.getVttState(roomId),
    client.getRoomState(roomId).catch(() => []),
    client.getRoomMembers(roomId).catch(() => []),
  ]);

  const stateArr = Array.isArray(fullState) ? fullState : [];
  const accessible = stateArr.length > 0;

  const isLive = (e) => e?.content && Object.keys(e.content).length > 0;
  // Yjs-routed types (CHARACTER / NPC) are no longer discrete state
  // events - read them from the room's snapshot. Fall back to legacy
  // state events for unmigrated rooms.
  const fromSnapshot = _entitiesFromSnapshot(stateArr);
  const legacyCharacters = stateArr
    .filter((e) => e.type === EVENT_TYPES.CHARACTER && isLive(e))
    .map((e) => ({ id: e.state_key, name: e.content.name || e.state_key }));
  const legacyNpcs = stateArr
    .filter((e) => e.type === EVENT_TYPES.NPC && isLive(e))
    .map((e) => ({ id: e.state_key, name: e.content.name || e.state_key }));
  const characters = fromSnapshot.characters.length > 0 ? fromSnapshot.characters : legacyCharacters;
  const npcs = fromSnapshot.npcs.length > 0 ? fromSnapshot.npcs : legacyNpcs;

  const joinRulesEvent = stateArr.find((e) => e.type === 'm.room.join_rules');
  const joinRule = joinRulesEvent?.content?.join_rule || null;

  const memberCount = members.length > 0
    ? members.length
    : stateArr.filter((e) => e.type === 'm.room.member' && e.content?.membership === 'join').length;

  let vtt = null;
  if (vttState && Object.keys(vttState).length > 0) {
    vtt = {
      campaignName: vttState.name || '',
      system: vttState.system || null,
      gmIds: Array.isArray(vttState.gm_user_ids) ? vttState.gm_user_ids : [],
    };
  }

  return {
    roomId,
    name: name || roomId,
    memberCount,
    accessible,
    vtt,
    characters,
    npcs,
    joinRule,
  };
}

function visibilityLabel(joinRule) {
  if (joinRule === 'public') return 'Public';
  if (joinRule === 'knock' || joinRule === 'knock_restricted') return 'Knock-required';
  if (joinRule === 'invite') return 'Invite-only';
  return 'Unknown visibility';
}

function buildPreviewBody(preview) {
  const { name, memberCount, vtt, characters, npcs, joinRule, accessible, notFound } = preview;
  const safeName = escapeHtml(name);
  const memberLine = memberCount
    ? `<div class="room-meta">${memberCount} member${memberCount === 1 ? '' : 's'} · ${escapeHtml(visibilityLabel(joinRule))}</div>`
    : `<div class="room-meta">${escapeHtml(visibilityLabel(joinRule))}</div>`;

  let warning = '';
  if (notFound) {
    warning = '<p class="error visible" style="margin: 12px 0;">Room not found on this homeserver. Check the ID/alias and try again.</p>';
  } else if (!accessible) {
    warning = '<p style="margin: 12px 0; opacity: 0.85;">Private room - details are hidden until you join.</p>';
  }

  let campaign = '';
  if (vtt) {
    const gms = vtt.gmIds.length
      ? `<div>GM: ${vtt.gmIds.map(escapeHtml).join(', ')}</div>`
      : '';
    campaign = `
      <div style="margin: 12px 0; padding: 10px; background: var(--surface, rgba(255,255,255,0.04)); border-radius: 6px;">
        <div><strong>Campaign:</strong> ${escapeHtml(vtt.campaignName || '(unnamed)')}</div>
        <div><strong>System:</strong> ${escapeHtml(vtt.system || 'generic')}</div>
        ${gms}
      </div>`;
  } else if (accessible) {
    campaign = '<p style="margin: 12px 0; opacity: 0.85;">No VTT campaign set up here yet - you\'ll start with the setup wizard.</p>';
  }

  let roster = '';
  const lines = [];
  if (characters.length) {
    lines.push(`<div><strong>Characters (${characters.length}):</strong> ${characters.map((c) => escapeHtml(c.name)).join(', ')}</div>`);
  }
  if (npcs.length) {
    lines.push(`<div><strong>NPCs (${npcs.length}):</strong> ${npcs.map((n) => escapeHtml(n.name)).join(', ')}</div>`);
  }
  if (lines.length) {
    roster = `<div style="margin: 12px 0;">${lines.join('')}</div>`;
  }

  const isKnock = joinRule === 'knock' || joinRule === 'knock_restricted';
  const confirmLabel = notFound
    ? null
    : (isKnock ? 'Request to Join' : 'Join Room');
  const confirmBtn = confirmLabel
    ? `<button type="button" class="dbt btn-primary" data-confirm>${escapeHtml(confirmLabel)}</button>`
    : '';

  return `
    <div class="room-name" style="font-size: 1.2em; margin-bottom: 4px;">${safeName}</div>
    ${memberLine}
    ${warning}
    ${campaign}
    ${roster}
    <div class="form-actions" style="margin-top: 16px;">
      <button type="button" class="dbt" data-cancel>Cancel</button>
      ${confirmBtn}
    </div>
  `;
}

function RoomPreviewBody({ preview, onConfirm, onCancel, onClose }) {
  const rootRef = useRef(null);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const cancel = root.querySelector('[data-cancel]');
    const conf = root.querySelector('[data-confirm]');
    const onCancelClick = () => { onClose(); onCancel?.(); };
    const onConfirmClick = () => { onClose(); onConfirm?.(); };
    cancel?.addEventListener('click', onCancelClick);
    conf?.addEventListener('click', onConfirmClick);
    return () => {
      cancel?.removeEventListener('click', onCancelClick);
      conf?.removeEventListener('click', onConfirmClick);
    };
  }, []);
  return h('div', { ref: rootRef, dangerouslySetInnerHTML: { __html: buildPreviewBody(preview) } });
}

export function showRoomPreview(preview, handlers = {}) {
  const { onConfirm, onCancel } = handlers;
  return openModal((close) =>
    h(Modal, {
      id: 'room-preview-modal', title: 'Confirm join', maxWidth: '480px',
      autoFocusSelector: '[data-confirm], [data-cancel]', onClose: close,
    }, h(RoomPreviewBody, { preview, onConfirm, onCancel, onClose: close })),
  );
}

export async function confirmAndEnterRoom(app, idOrAlias, displayName, forceWizard = false, via = []) {
  app.appLog.add('info', `→ confirmAndEnterRoom ${idOrAlias}`);
  let preview;
  try {
    preview = await previewRoom(app.auth.client, idOrAlias);
    app.appLog.add('info', `  preview ok name="${preview?.name ?? ''}" notFound=${!!preview?.notFound}`);
  } catch (err) {
    app.appLog.add('error', `✗ preview failed: ${err.message}`);
    app.setError('discovery-error', `Could not preview ${idOrAlias}: ${err.message}`);
    return;
  }
  app.appLog.add('info', '  showing room-preview modal');
  showRoomPreview(preview, {
    onConfirm: () => {
      app.appLog.add('info', '  modal confirmed → enterRoom');
      return enterRoom(app, idOrAlias, displayName || preview.name, forceWizard, via);
    },
    onCancel: () => app.appLog.add('info', '  modal cancelled'),
  });
}
