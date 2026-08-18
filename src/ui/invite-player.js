/**
 * invite-player.js - GM action to invite a Matrix user to the campaign
 * room from inside the app. Standalone mode delegates to the /invite
 * endpoint via ClientManager; widget mode writes the m.room.member
 * state event through the same capability kick/ban already use.
 */

import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';
import { MODAL_WIDTHS } from '../utils/ui-constants.js';
import { viaServersFor } from '../utils/matrix-ids.js';

export function isValidMatrixUserId(input) {
  if (typeof input !== 'string') return false;
  return /^@[^:@\s]+:\S+$/.test(input.trim());
}

export function describeInviteError(err) {
  const code = err?.errcode || err?.data?.errcode;
  if (code === 'M_FORBIDDEN') {
    return "You don't have permission to invite to this room, or the user is already a member.";
  }
  if (code === 'M_LIMIT_EXCEEDED') {
    return 'Server rate limit reached. Wait a moment and try again.';
  }
  if (code === 'M_NOT_FOUND' || code === 'M_UNKNOWN') {
    return 'No user with that ID was found. Check the spelling and homeserver.';
  }
  return err?.message ? `Invite failed: ${err.message}` : 'Invite failed. Try again.';
}

export function buildInviteLink(target, via = []) {
  const base = `https://matrix.to/#/${encodeURIComponent(target)}`;
  if (via.length === 0) return base;
  const params = via.map((s) => `via=${encodeURIComponent(s)}`).join('&');
  return `${base}?${params}`;
}

export function joinRuleFrom(stateEvents) {
  if (!Array.isArray(stateEvents)) return null;
  const rule = stateEvents.find((e) => e?.type === 'm.room.join_rules')?.content?.join_rule;
  return typeof rule === 'string' ? rule : null;
}

export function canonicalAliasFrom(stateEvents) {
  if (!Array.isArray(stateEvents)) return null;
  const event = stateEvents.find((e) => e?.type === 'm.room.canonical_alias');
  const alias = event?.content?.alias;
  return typeof alias === 'string' && alias.startsWith('#') ? alias : null;
}

export async function roomInviteLink(manager) {
  let alias;
  try {
    alias = canonicalAliasFrom(await manager.getRoomState());
  } catch {
    alias = null;
  }
  const target = alias || manager.roomId;
  if (!target) return null;
  // Aliases resolve on their own; bare room IDs need the via hint.
  return buildInviteLink(target, alias ? [] : viaServersFor(target));
}

function InviteBody({ ui, close }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [joinRule, setJoinRule] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rule = joinRuleFrom(await ui.widgetManager.getRoomState?.());
        if (alive) setJoinRule(rule);
      } catch {
        // Unknown join rule: keep the invite-first copy below.
      }
    })();
    return () => { alive = false; };
  }, []);

  const send = async (e) => {
    e.preventDefault();
    const userId = inputRef.current?.value.trim() ?? '';
    if (!isValidMatrixUserId(userId)) {
      setError('Enter a full Matrix ID like @name:matrix.org.');
      return;
    }
    setError('');
    setSending(true);
    try {
      await ui.widgetManager.inviteUser(userId);
      ui._toast?.(`Invited ${userId}. They will see the invite in their client.`, 'success');
      close();
    } catch (err) {
      setError(describeInviteError(err));
    } finally {
      setSending(false);
    }
  };

  const copyLink = async () => {
    setError('');
    try {
      const link = await roomInviteLink(ui.widgetManager);
      if (!link) throw new Error('no room ID available');
      await navigator.clipboard.writeText(link);
      ui._toast?.('Invite link copied to clipboard.', 'success');
    } catch (err) {
      setError(`Could not copy the invite link: ${err.message}`);
    }
  };

  return h('form', { onSubmit: send, novalidate: true }, [
    h('p', { class: 'editorial-body' },
      'Enter the player\'s Matrix ID. They\'ll get a room invite they can accept from this app or any Matrix client.'),
    h('label', { for: 'invite-user-id' }, 'Matrix ID'),
    h('input', {
      id: 'invite-user-id', class: 'form-input', type: 'text',
      placeholder: '@name:matrix.org', autocomplete: 'off', ref: inputRef,
    }),
    error && h('div', { class: 'auth-error visible', role: 'alert' }, error),
    h('div', { class: 'form-actions', style: 'display:flex;justify-content:flex-end;gap:8px;' }, [
      h('button', { class: 'dbt', type: 'button', 'data-modal-close': true }, 'Cancel'),
      h('button', { class: 'dbt btn-primary', type: 'submit', disabled: sending },
        sending ? 'Inviting…' : 'Send invite'),
    ]),
    h('div', { class: 'new-session-divider' }, 'then'),
    joinRule === 'knock'
      ? h('p', { class: 'editorial-body' },
          'This room accepts join requests: anyone you send the link can ask to join, ' +
          'and you approve each request from the party roster. ' +
          'Players you have already invited go straight in.')
      : h('p', { class: 'editorial-body' },
          'This room is invite-only: send the Matrix ID invite above first. ' +
          'The link then routes invited players straight to the session - they paste it into MatrixVTT\'s join field or open it in any Matrix client.'),
    h('button', {
      class: 'dbt', type: 'button', id: 'copy-invite-link-btn', onClick: copyLink,
    }, 'Copy invite link'),
  ]);
}

export function showInvitePlayerModal(ui) {
  openModal((close) => h(Modal, {
    id: 'invite-player-modal',
    title: 'Invite player',
    maxWidth: MODAL_WIDTHS.SMALL,
    closeOnOverlay: true,
    closeOnEscape: true,
    autoFocusSelector: '#invite-user-id',
    onClose: close,
  }, [h(InviteBody, { ui, close })]));
}
