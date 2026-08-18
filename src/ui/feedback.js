/**
 * feedback.js - in-app feedback channel for the public beta.
 *
 * No public repo yet, so testers can't file GitHub issues. This surfaces a
 * "Send feedback" modal with the owner's contact (Matrix / Mastodon) plus a
 * one-click "Copy diagnostics" that bundles the build version, URL, browser,
 * and the captured app-log so a bug report is actually actionable.
 *
 * Contacts are build-time configurable so the destination isn't hard-coded
 * into the bundle for everyone who forks/rebuilds.
 */

import { h } from 'preact';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';
import { MODAL_WIDTHS } from '../utils/ui-constants.js';
import { BUILD_VERSION } from '../utils/constants.js';
import { readPersistedLog } from '../standalone/app-log.js';
import {
  FEEDBACK_MATRIX as MATRIX_ID, FEEDBACK_MASTODON as MASTODON, matrixUrl, mastodonUrl,
} from '../utils/feedback-contacts.js';

/** Build a paste-ready diagnostics report. Pure + testable. */
export function buildDiagnostics(win = window) {
  return [
    'MatrixVTT diagnostics',
    `version: ${BUILD_VERSION}`,
    `url: ${win.location?.href ?? ''}`,
    `userAgent: ${win.navigator?.userAgent ?? ''}`,
    `time: ${new Date().toISOString()}`,
    '',
    '--- recent log ---',
    readPersistedLog(win) || '(log empty)',
  ].join('\n');
}

export function showFeedbackModal(ui) {
  openModal((close) => {
    const copyDiagnostics = async (e) => {
      const btn = e.currentTarget;
      try {
        await navigator.clipboard.writeText(buildDiagnostics());
        if (btn) btn.textContent = 'Copied ✓';
        ui?._toast?.('Diagnostics copied. Paste them into your message.', 'success');
      } catch {
        ui?._toast?.('Copy failed. Select the log in ⋯ and copy manually.', 'error');
      }
    };

    return h(Modal, {
      id: 'feedback-modal',
      title: 'Send feedback',
      maxWidth: MODAL_WIDTHS.MEDIUM,
      closeOnOverlay: true,
      closeOnEscape: true,
      onClose: close,
    }, [
      h('p', { class: 'editorial-body' },
        'This is a beta. Bug reports and ideas are very welcome. Reach me on:'),
      h('ul', null, [
        h('li', null, h('a', { href: matrixUrl(MATRIX_ID), target: '_blank', rel: 'noopener noreferrer' }, `Matrix · ${MATRIX_ID}`)),
        h('li', null, h('a', { href: mastodonUrl(MASTODON), target: '_blank', rel: 'noopener noreferrer' }, `Mastodon · ${MASTODON}`)),
      ]),
      h('p', { class: 'editorial-body' },
        'For bugs, copy the diagnostics below and paste them into your message. It includes the app version and recent log (no homeserver credentials).'),
      h('div', { class: 'form-actions', style: 'display:flex;justify-content:space-between;gap:8px;' }, [
        h('button', { class: 'dbt', type: 'button', onClick: copyDiagnostics }, 'Copy diagnostics'),
        h('button', { class: 'dbt btn-primary', 'data-modal-close': true }, 'Close'),
      ]),
    ]);
  });
}
