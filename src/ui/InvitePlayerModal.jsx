/**
 * Invite modal. The player link comes first because it is what a GM
 * actually pastes into chat; the Matrix ID invite and the matrix.to
 * link sit behind disclosures for the cases that need them.
 */

import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';
import { MODAL_WIDTHS } from '../utils/ui-constants.js';
import { JOIN_RULE } from '../utils/join-rules.js';
import { retryOnRateLimit } from '../utils/matrixRetry.js';
import { describeNetworkError } from '../utils/errorHandling.js';
import { buildShareMessage, roomInviteLinks } from './invite-link.js';
import { describeInviteError, isValidMatrixUserId, joinRuleFrom } from './invite-player.js';

const ACCESS = {
  [JOIN_RULE.KNOCK]: 'Anyone with this link can ask to join. You approve each request from the party roster, and players you invited go straight in.',
  [JOIN_RULE.PUBLIC]: 'Anyone with this link can join straight away.',
  [JOIN_RULE.INVITE]: 'Only players you invite by Matrix ID can use this link.',
  unknown: 'Could not read this room\'s access setting. If the link does not let a player in, allow join requests or invite them by Matrix ID.',
};

function accessCopy(joinRule) {
  return ACCESS[joinRule] || ACCESS.unknown;
}

function LinkRow({ id, label, value, buttonId, buttonLabel, primary, onCopy }) {
  return h('div', { class: 'invite-link-row' }, [
    h('label', { for: id, class: 'sr-only' }, label),
    h('input', { id, class: 'form-input', type: 'text', readOnly: true, value, onFocus: (e) => /** @type {HTMLInputElement} */ (e.target).select() }),
    h('button', {
      id: buttonId, type: 'button', class: primary ? 'dbt btn-primary' : 'dbt', onClick: onCopy,
    }, buttonLabel),
  ]);
}

function InviteBody({ ui, close }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [joinRule, setJoinRule] = useState(null);
  const [links, setLinks] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const resolved = await roomInviteLinks(ui.widgetManager);
      if (alive) setLinks(resolved);
      try {
        const rule = joinRuleFrom(await ui.widgetManager.getRoomState?.());
        if (alive) setJoinRule(rule);
      } catch {
        // Unknown join rule: the access line says so rather than guessing.
      }
    })();
    return () => { alive = false; };
  }, []);

  const copy = async (value, what) => {
    setError('');
    try {
      await navigator.clipboard.writeText(value);
      ui._toast?.(`${what} copied to clipboard.`, 'success');
    } catch (err) {
      setError(`Could not copy the ${what.toLowerCase()}: ${err.message}`);
    }
  };

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

  const allowKnocks = async () => {
    setError('');
    setSwitching(true);
    try {
      await retryOnRateLimit(() => ui.widgetManager.setJoinRule(JOIN_RULE.KNOCK));
      setJoinRule(JOIN_RULE.KNOCK);
      ui._toast?.('Players with the link can now request to join.', 'success');
    } catch (err) {
      setError(`Could not change who can join: ${describeNetworkError(err)}`);
    } finally {
      setSwitching(false);
    }
  };

  const canKnock = joinRule === JOIN_RULE.KNOCK || joinRule === 'knock_restricted';
  const isOpen = joinRule === JOIN_RULE.PUBLIC;
  const playerLink = links?.playerLink ?? '';

  return h('div', { class: 'invite-modal' }, [
    h('p', { class: 'editorial-body' },
      'Send this link to your players. It opens MatrixVTT, where they sign in or create a free account, and drops them into this campaign.'),

    links === null
      ? h('p', { class: 'room-empty' }, 'Building the invite link…')
      : h('div', null, [
          h(LinkRow, {
            id: 'invite-player-link', label: 'Player invite link', value: playerLink,
            buttonId: 'copy-player-link-btn', buttonLabel: 'Copy player link', primary: true,
            onCopy: () => copy(playerLink, 'Player link'),
          }),
          h('button', {
            id: 'copy-invite-message-btn', type: 'button', class: 'dbt dbt--sm',
            onClick: () => copy(
              buildShareMessage({ roomName: ui.state?.settings?.name, playerLink }),
              'Invite message',
            ),
          }, 'Copy invite message'),
        ]),

    h('p', { id: 'invite-access-state', class: 'invite-access', role: 'status' }, accessCopy(joinRule)),

    !canKnock && !isOpen && h('button', {
      id: 'allow-knock-btn', type: 'button', class: 'dbt', disabled: switching, onClick: allowKnocks,
    }, switching ? 'Changing…' : 'Let anyone with the link request to join'),

    error && h('div', { class: 'auth-error visible', role: 'alert' }, error),

    h('details', { class: 'invite-details', open: !canKnock && !isOpen }, [
      h('summary', null, 'Invite a specific Matrix user'),
      h('form', { onSubmit: send, novalidate: true }, [
        h('p', { class: 'editorial-body' },
          'Players who already use Matrix get an invite in their own client, and can always get in.'),
        h('label', { for: 'invite-user-id' }, 'Matrix ID'),
        h('input', {
          id: 'invite-user-id', class: 'form-input', type: 'text',
          placeholder: '@name:matrix.org', autocomplete: 'off', ref: inputRef,
        }),
        h('div', { class: 'form-actions' }, [
          h('button', { id: 'send-invite-btn', class: 'dbt', type: 'submit', disabled: sending },
            sending ? 'Inviting…' : 'Send invite'),
        ]),
      ]),
    ]),

    links && h('details', { class: 'invite-details' }, [
      h('summary', null, 'Matrix link'),
      h('p', { class: 'editorial-body' }, 'For players who already run a Matrix client.'),
      h(LinkRow, {
        id: 'invite-matrix-to-link', label: 'Matrix link', value: links.matrixToLink,
        buttonId: 'copy-matrix-link-btn', buttonLabel: 'Copy Matrix link', primary: false,
        onCopy: () => copy(links.matrixToLink, 'Matrix link'),
      }),
    ]),

    h('div', { class: 'form-actions' }, [
      h('button', { class: 'dbt', type: 'button', 'data-modal-close': true }, 'Done'),
    ]),
  ]);
}

export function showInvitePlayerModal(ui) {
  openModal((close) => h(Modal, {
    id: 'invite-player-modal',
    title: 'Invite players',
    maxWidth: MODAL_WIDTHS.MEDIUM,
    closeOnOverlay: true,
    closeOnEscape: true,
    autoFocusSelector: '#invite-player-link',
    onClose: close,
  }, [h(InviteBody, { ui, close })]));
}
