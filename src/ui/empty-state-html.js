/**
 * String-template sibling of EmptyState.jsx for legacy `.js`
 * UI files. The host wires one delegated click listener:
 *   container.addEventListener('click', e => {
 *     const action = e.target.closest('[data-empty-cta]')?.dataset.emptyCta;
 *     if (action) actions[action]?.();
 *   });
 */
import { esc } from '../utils/domHelpers.js';

/**
 * @param {string} message
 * @param {{ label: string, action: string } | undefined} [cta]
 * @returns {string}
 */
export function emptyStateHtml(message, cta) {
  const ctaHtml = cta
    ? `<button type="button" class="dbt btn-primary" data-empty-cta="${esc(cta.action)}">${esc(cta.label)}</button>`
    : '';
  return `<div class="empty-state" role="status">
    <p class="empty-state__msg">${esc(message)}</p>
    ${ctaHtml}
  </div>`;
}
