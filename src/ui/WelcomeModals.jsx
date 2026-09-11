/**
 * WelcomeModals.jsx - the waiting-for-GM / auth-failure screen a player
 * sees when a room has no session yet.
 */

import { h } from 'preact';
import { VTT_EVENTS } from '../utils/constants.js';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';

function WaitingForGMModal({ ui, authOk, diag = null, onClose }) {
  const [title, body] = !authOk
    ? [
        'Authentication Failed',
        `MatrixVTT could not verify your identity.<br>
         This usually means the homeserver's OpenID endpoint is unreachable or blocked by CORS.<br><br>
         Try reloading the widget. If the problem persists, check the browser console for details.`
      ]
    : [
        'Waiting for GM',
        `No session has been set up in this room yet.<br>
         A room moderator or GM needs to create the session first.`
      ];

  const onLeave = () => {
    onClose();
    window.dispatchEvent(new CustomEvent(VTT_EVENTS.LEAVE_ROOM));
  };

  const onRetry = () => {
    onClose();
    ui.showFirstTimeSetup();
  };

  return h(Modal, {
    id: 'waiting-gm-modal',
    title,
    maxWidth: '420px',
    onClose,
  }, [
    h('p', {
      class: 'welcome-modal__body',
      dangerouslySetInnerHTML: { __html: body },
    }),
    diag && h('p', {
      'data-waiting-diag': '',
      class: 'welcome-modal__diag',
    }, `${diag.userId} · ${diag.roomId} · power level ${diag.level} (GM needs 50)`),
    h('div', { class: 'form-actions welcome-modal__actions' }, [
      !authOk && h('button', { type: 'button', class: 'dbt btn-primary w-full', onClick: () => window.location.reload() }, 'Reload'),
      authOk && h('button', { type: 'button', class: 'dbt btn-primary w-full', onClick: onRetry }, 'Retry'),
      ui.widgetManager?.isAppClient && h('button', { type: 'button', class: 'dbt w-full', onClick: onLeave }, '← Back to Discovery'),
    ]),
  ]);
}

export function showWaitingForGM(ui, authOk, diag = null) {
  openModal((close) => h(WaitingForGMModal, { ui, authOk, diag, onClose: close }));
}
