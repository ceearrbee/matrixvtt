/**
 * keyboard-help.js - Keyboard shortcut reference panel.
 *
 * Call showKeyboardHelp() to open a modal listing all keyboard shortcuts.
 * Press ? (outside an input field) to trigger it from useKeyboardShortcuts.
 */

import { h } from 'preact';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';
import { MODAL_WIDTHS } from '../utils/ui-constants.js';
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

// The cone is a shape of the template tool rather than a tool of its
// own, so it has no toolbar tooltip for tooltipToRow to derive.
const TEMPLATE_SHAPE_ROWS = [
  { key: 'K', desc: 'Cone template (GM) - same control as the circle template' },
];

const TOKEN_MOVEMENT_ROWS = [
  { key: 'N / Shift+N', desc: 'Select the next / previous token on the map' },
  { key: 'Arrow keys', desc: 'Move the selected token by one cell (Shift = 5 cells)' },
  { key: 'Enter',      desc: 'Commit the move' },
  { key: 'Esc',        desc: 'Put the token back where it started' },
];

const GLOBAL_ROWS = [
  { key: 'E',          desc: 'Erase drawing' },
  { key: 'G',          desc: 'Ping location on map' },
  { key: 'Ctrl+Z',     desc: 'Undo last drawing stroke' },
  { key: 'Ctrl+Y',     desc: 'Redo drawing stroke' },
  { key: 'Ctrl+Shift+D', desc: 'Toggle debug mode' },
  { key: 'Ctrl+K',     desc: 'Search the campaign or run a command, from anywhere including the chat box' },
  { key: '/',          desc: 'The same palette, when you are not typing in a field' },
  { key: '?',          desc: 'Show this keyboard shortcut help' },
  { key: 'F',          desc: 'Focus mode: hide both side rails, and show them again' },
  { key: 'Esc',        desc: 'Close the open drawer' },
  { key: '← →',        desc: 'Move between the companion tabs, once one has focus' },
];

const SHORTCUTS = [...MAP_TOOL_ROWS, ...TEMPLATE_SHAPE_ROWS, ...TOKEN_MOVEMENT_ROWS, ...GLOBAL_ROWS];

// Chat commands, typed into the composer. This panel is the only place
// they are taught, so it carries them alongside the key bindings.
const COMMAND_ROWS = [
  { key: '/roll 1d20+5', desc: 'Roll dice in chat (aliases: /r, !roll, !r)' },
  { key: '/w @user',     desc: 'Whisper privately to another player' },
  { key: '/as Name',     desc: 'Speak as a named character or NPC' },
  { key: '/asd Name',    desc: 'Describe an action as a named character' },
];

export function showKeyboardHelp() {
  openModal((close) => h(Modal, {
      id: 'kbd-help-modal',
      title: 'Keyboard Shortcuts',
      maxWidth: MODAL_WIDTHS.MEDIUM,
      closeOnOverlay: true,
      closeOnEscape: true,
      onClose: close,
    }, [
      h('table', { style: 'border-collapse:collapse;width:100%;font-size:0.875rem;' },
        SHORTCUTS.map(({ key, desc }) => h('tr', null, [
          h('td', { style: 'padding:var(--space-xs) var(--space-xl) var(--space-xs) 0;white-space:nowrap;' },
            h('kbd', { style: 'font-family:var(--font-mono);background:var(--color-background-secondary);border:1px solid var(--color-border-primary);border-radius:var(--border-radius-lg);padding:var(--space-2xs) var(--space-sm);' }, key)),
          h('td', { style: 'padding:var(--space-xs) 0;' }, desc),
        ]))),
      h('h3', { style: 'margin:var(--space-2xl) 0 var(--space-md);font-size:var(--font-size-sm);' }, 'Chat commands'),
      h('table', { style: 'border-collapse:collapse;width:100%;font-size:0.875rem;' },
        COMMAND_ROWS.map(({ key, desc }) => h('tr', null, [
          h('td', { style: 'padding:var(--space-xs) var(--space-xl) var(--space-xs) 0;white-space:nowrap;' },
            h('kbd', { style: 'font-family:var(--font-mono);background:var(--color-background-secondary);border:1px solid var(--color-border-primary);border-radius:var(--border-radius-lg);padding:var(--space-2xs) var(--space-sm);' }, key)),
          h('td', { style: 'padding:var(--space-xs) 0;' }, desc),
        ]))),
      h('div', { class: 'form-actions', style: 'display:flex;justify-content:flex-end;' },
        h('button', { class: 'dbt btn-primary', 'data-modal-close': true }, 'Close')),
    ]));
}
