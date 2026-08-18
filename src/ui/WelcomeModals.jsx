/**
 * WelcomeModals.jsx - Preact components for the player welcome
 * and waiting-for-GM screens.
 */

import { h, render } from 'preact';
import { VTT_EVENTS } from '../utils/constants.js';
import { trapFocusIn } from '../utils/ui-helpers.js';

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

  return h('div', {
    class: 'modal-overlay',
    tabIndex: -1,
    onClick: (e) => { if (e.target === e.currentTarget) onClose(); },
    onKeyDown: (e) => { if (e.key === 'Escape') onClose(); },
  },
    h('div', { class: 'modal-content welcome-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'waiting-gm-title' }, [
      h('div', { class: 'modal-header' }, [
        h('h2', { id: 'waiting-gm-title' }, title),
        h('button', { class: 'modal-close', 'aria-label': 'Close', onClick: onClose }, '✕'),
      ]),
      h('div', { class: 'modal-body' }, [
        h('p', {
          class: 'welcome-modal__body',
          dangerouslySetInnerHTML: { __html: body }
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
      ]),
    ]));
}

function PlayerWelcomeModal({ ui, hasCharacters = true, onClose }) {
  const onLeave = () => {
    onClose();
    window.dispatchEvent(new CustomEvent(VTT_EVENTS.LEAVE_ROOM));
  };

  // A fresh room may have no characters authored yet; promising a
  // claimable character there sends the player hunting for something
  // that does not exist.
  const body = hasCharacters
    ? [
        'Your GM has set up this session.', h('br', null),
        'Click a character in the sheet panel to ', h('strong', null, 'claim'), ' it and start playing.',
      ]
    : [
        'Your GM has set up this session.', h('br', null),
        'There are no characters here yet. Watch the map and chat, or create your own from the sheet panel.',
      ];

  return h('div', {
    class: 'modal-overlay',
    tabIndex: -1,
    onClick: (e) => { if (e.target === e.currentTarget) onClose(); },
    onKeyDown: (e) => { if (e.key === 'Escape') onClose(); },
  },
    h('div', {
      class: 'modal-content welcome-modal welcome-modal--center',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'player-welcome-title',
    }, [
      h('h2', { id: 'player-welcome-title', class: 'welcome-modal__title' }, 'Welcome to the Session'),
      h('p', { class: 'welcome-modal__text' }, body),
      h('div', { class: 'row-md' }, [
        ui.widgetManager?.isAppClient && h('button', { type: 'button', class: 'dbt flex-1', onClick: onLeave }, '← Leave'),
        h('button', { type: 'button', class: 'dbt btn-primary flex-2', onClick: onClose }, 'Got it'),
      ]),
    ]));
}

export function showWaitingForGM(ui, authOk, diag = null) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const close = () => { render(null, host); host.remove(); };
  render(h(WaitingForGMModal, { ui, authOk, diag, onClose: close }), host);
  trapFocusIn(host);
}

export function showPlayerWelcome(ui, { hasCharacters = true } = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const close = () => { render(null, host); host.remove(); };
  render(h(PlayerWelcomeModal, { ui, hasCharacters, onClose: close }), host);
  trapFocusIn(host);
}
