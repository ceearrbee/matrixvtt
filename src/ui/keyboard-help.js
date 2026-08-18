/**
 * keyboard-help.js - Keyboard shortcut reference panel.
 *
 * Call showKeyboardHelp() to open a modal listing all keyboard shortcuts.
 * Press ? (outside an input field) to trigger it from event-handlers.js.
 */

import { h } from 'preact';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';
import { MODAL_WIDTHS } from '../utils/ui-constants.js';
import { restartOnboardingTour } from './onboarding-tour.js';
import { TOOLS, GM_TOOLS } from './MapStrip.jsx';

// Derive a key+desc row from a TOOLS tuple. Tooltip strings end with
// "(K)" - pull the K and strip the suffix. Single source of truth so
// the shortcut list never drifts from the toolbar.
function tooltipToRow(tuple) {
  const tooltip = tuple[2];
  const m = /\(([^)]+)\)\s*$/.exec(tooltip);
  const key = m ? m[1] : '';
  const desc = m ? tooltip.slice(0, m.index).trim() : tooltip;
  return { key, desc };
}

const MAP_TOOL_ROWS = [...TOOLS, ...GM_TOOLS]
  .filter(Boolean)
  .map(tooltipToRow)
  .filter((r) => r.key);

const TOKEN_MOVEMENT_ROWS = [
  { key: 'N / Shift+N', desc: 'Select the next / previous token on the map' },
  { key: 'M',          desc: 'Token movement mode (with token selected)' },
  { key: 'Arrow keys', desc: 'Move selected token by one cell (Shift = 5 cells)' },
  { key: 'Esc',        desc: 'Exit movement mode' },
];

const GLOBAL_ROWS = [
  { key: 'E',          desc: 'Erase drawing' },
  { key: 'G',          desc: 'Ping location on map' },
  { key: 'Ctrl+Z',     desc: 'Undo last drawing stroke' },
  { key: 'Ctrl+Y',     desc: 'Redo drawing stroke' },
  { key: 'Ctrl+Shift+D', desc: 'Toggle debug mode' },
  { key: '/',          desc: 'Open the search palette (find any token, character, item, …)' },
  { key: '?',          desc: 'Show this keyboard shortcut help' },
];

const SHORTCUTS = [...MAP_TOOL_ROWS, ...TOKEN_MOVEMENT_ROWS, ...GLOBAL_ROWS];

// Chat commands, typed into the composer. Tour step 11 was the only
// other place these were taught; a dismissed tour hid them forever.
const COMMAND_ROWS = [
  { key: '/roll 1d20+5', desc: 'Roll dice in chat (aliases: /r, !roll, !r)' },
  { key: '/w @user',     desc: 'Whisper privately to another player' },
  { key: '/as Name',     desc: 'Speak as a named character or NPC' },
  { key: '/asd Name',    desc: 'Describe an action as a named character' },
];

export function showKeyboardHelp(ui) {
  openModal((close) => {
    const restartTour = () => { close(); restartOnboardingTour(ui); };
    return h(Modal, {
      id: 'kbd-help-modal',
      title: 'Keyboard Shortcuts',
      maxWidth: MODAL_WIDTHS.MEDIUM,
      closeOnOverlay: true,
      closeOnEscape: true,
      onClose: close,
    }, [
      h('table', { style: 'border-collapse:collapse;width:100%;font-size:0.875rem;' },
        SHORTCUTS.map(({ key, desc }) => h('tr', null, [
          h('td', { style: 'padding:4px 12px 4px 0;white-space:nowrap;' },
            h('kbd', { style: 'font-family:var(--font-mono);background:var(--color-background-secondary);border:1px solid var(--color-border-primary);border-radius:var(--border-radius-lg);padding:2px 6px;' }, key)),
          h('td', { style: 'padding:4px 0;' }, desc),
        ]))),
      h('h3', { style: 'margin:16px 0 8px;font-size:var(--font-size-sm);' }, 'Chat commands'),
      h('table', { style: 'border-collapse:collapse;width:100%;font-size:0.875rem;' },
        COMMAND_ROWS.map(({ key, desc }) => h('tr', null, [
          h('td', { style: 'padding:4px 12px 4px 0;white-space:nowrap;' },
            h('kbd', { style: 'font-family:var(--font-mono);background:var(--color-background-secondary);border:1px solid var(--color-border-primary);border-radius:var(--border-radius-lg);padding:2px 6px;' }, key)),
          h('td', { style: 'padding:4px 0;' }, desc),
        ]))),
      h('div', { class: 'form-actions', style: 'display:flex;justify-content:space-between;gap:8px;' }, [
        h('button', { class: 'dbt', id: 'restart-tour-btn', type: 'button', onClick: restartTour }, 'Restart tour'),
        h('button', { class: 'dbt btn-primary', 'data-modal-close': true }, 'Close'),
      ]),
    ]);
  });
}
