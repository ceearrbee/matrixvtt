import { esc } from './domHelpers.js';

/**
 * Render a fatal application error into the provided mount element.
 * Accepts a plain string, or a structured `{title, lines, hint}` shape
 * for errors that carry a list (e.g. denied widget capabilities).
 * Every part is escaped individually - markup never rides in the data.
 *
 * @param {HTMLElement | null} app
 * @param {string | {title: string, lines?: string[], hint?: string}} message
 * @param {() => void} [onReload]
 */
export function renderFatalError(app, message, onReload = () => window.location.reload()) {
  if (!app) return;
  app.innerHTML = typeof message === 'string'
    ? _getFatalErrorHtml(message)
    : _getStructuredErrorHtml(message);
  app.querySelector('[data-reload-app]')?.addEventListener('click', onReload);
}

const WRAP_STYLE = 'display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100dvh; padding: 20px; text-align: center;';

function _getFatalErrorHtml(message) {
  return `
    <div style="${WRAP_STYLE}">
      <h2 style="color: var(--color-text-danger); margin-bottom: 12px;">Error</h2>
      <p style="color: var(--color-text-secondary); max-width: 500px;">${esc(message)}</p>
      <button type="button" data-reload-app style="margin-top: 20px; padding: 8px 16px;">Reload</button>
    </div>
  `;
}

function _getStructuredErrorHtml({ title, lines = [], hint = '' }) {
  const items = lines
    .map((line) => `<li style="font-family: var(--font-mono, monospace); font-size: 11px;">${esc(line)}</li>`)
    .join('');
  return `
    <div style="${WRAP_STYLE}">
      <h2 style="color: var(--color-text-danger); margin-bottom: 12px;">${esc(title)}</h2>
      ${items ? `<ul style="text-align: left; margin: 12px 0; max-width: 500px; color: var(--color-text-secondary);">${items}</ul>` : ''}
      ${hint ? `<p style="color: var(--color-text-secondary); max-width: 500px;">${esc(hint)}</p>` : ''}
      <button type="button" data-reload-app style="margin-top: 20px; padding: 8px 16px;">Reload</button>
    </div>
  `;
}
