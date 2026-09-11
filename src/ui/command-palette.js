/**
 * Command palette: one fuzzy search across everything the campaign
 * holds, and the commands you can run on it. Opens on Cmd/Ctrl+K
 * anywhere (including the chat composer, which holds the shell's
 * resting focus) or `/` outside a text field. Arrows + Enter picks;
 * a noun jumps to its contextual action (pan-to-token, open-sheet),
 * a verb runs it.
 *
 * The verbs live in `palette-commands.js`, which is where the
 * permission matrix is. This is the answer to "where is X" for the
 * features that otherwise need Prep, a right-click, or a tab inside
 * a modal.
 *
 * Backed by `fuse.js` for fuzzy matching; the index is rebuilt each
 * time the palette opens so it always reflects the current state.
 * For our typical campaign sizes (tens to a few hundred entities)
 * the rebuild is cheap and avoids signal-subscription complexity.
 */

import Fuse from 'fuse.js';
import { h } from 'preact';
import { useRef, useLayoutEffect } from 'preact/hooks';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';
import { logger } from '../utils/logger.js';
import { selectedTokenSignal } from '../state/ui-signals.js';
import { buildPaletteCommands } from './palette-commands.js';
import { openGMPanelModal } from './GMTab.jsx';

const PALETTE_ID = 'command-palette';
const MAX_RESULTS = 12;

const TYPE_LABELS = {
  command: 'Command',
  token: 'Token',
  character: 'Character',
  npc: 'NPC',
  item: 'Item',
  spell: 'Spell',
  handout: 'Handout',
  page: 'Page',
  map: 'Map',
  table: 'Roll table',
  pin: 'Pin',
};

function _buildIndex(state) {
  const entries = [];
  const push = (kind, map) => {
    if (!map) return;
    for (const [id, content] of map) {
      if (!content) continue;
      const name = content.name || content.title || content.label;
      if (typeof name !== 'string' || !name) continue;
      entries.push({ id, kind, name, content });
    }
  };
  push('token',     state.tokens);
  push('character', state.characters);
  push('npc',       state.npcs);
  push('item',      state.items);
  push('spell',     state.spells);
  push('handout',   state.handouts);
  // Half the Journal was unsearchable, and a map could not be found
  // from here at all.
  push('page',      state.pages);
  push('map',       state.maps);
  push('table',     state.tables);
  push('pin',       state.pins);
  return entries;
}

/** Verbs first: a command is what someone types the palette to reach. */
function _commandEntries(ui) {
  const isGM = ui.state?.isGM?.() === true;
  const combatActive = !!ui.state?.initiative?.active;
  const selectedId = selectedTokenSignal.value;
  const selectedToken = selectedId ? ui.state?.tokens?.get(selectedId) ?? null : null;
  return buildPaletteCommands(ui, { isGM, combatActive, selectedToken }).map((c) => ({
    id: c.id, kind: 'command', name: c.label, content: c,
  }));
}

function _selectResult(ui, entry) {
  switch (entry.kind) {
    case 'command':
      entry.content.run();
      break;
    case 'map':
      ui.state?.switchMap?.(entry.id);
      break;
    case 'page':
      ui.openDoc?.('page', entry.id);
      break;
    case 'table':
      openGMPanelModal(ui);
      break;
    case 'token':
      ui.mapRenderer?.panToToken?.(entry.id);
      ui.previewToken?.(entry.id);
      break;
    case 'character':
      ui.selectCharacterById?.(entry.id);
      break;
    case 'npc':
      ui.selectNPCById?.(entry.id);
      break;
    case 'item':
      ui.showItemPreview?.(entry.id);
      break;
    case 'spell':
      ui.showSpellPreview?.(entry.id);
      break;
    case 'handout':
      ui.showHandoutModal?.(entry.id);
      break;
    case 'pin': {
      const pin = entry.content;
      if (pin && typeof pin.col === 'number' && typeof pin.row === 'number' && ui.mapRenderer) {
        const cellPx = ui.state?.map?.cell_px ?? 40;
        ui.mapRenderer.panTo?.((pin.col + 0.5) * cellPx, (pin.row + 0.5) * cellPx);
      }
      break;
    }
    default:
      window.dispatchEvent(new CustomEvent('vtt:reveal-entity', { detail: { entityId: entry.id, kind: entry.kind } }));
  }
}

function _escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function _renderResults(modal, results, activeIndex) {
  const list = modal.querySelector('#cp-results');
  if (!list) return;
  const live = modal.querySelector('#cp-live');
  if (live) live.textContent = results.length === 0 ? 'No matches' : `${results.length} results`;
  if (results.length === 0) {
    list.innerHTML = '<div class="cp-empty">No matches</div>';
    return;
  }
  list.innerHTML = results.map((r, i) => `
    <div class="cp-row${i === activeIndex ? ' cp-row--active' : ''}" role="option"
         data-index="${i}" aria-selected="${i === activeIndex}">
      <span class="cp-row__kind">${_escapeHtml(TYPE_LABELS[r.item.kind] || r.item.kind)}</span>
      <span class="cp-row__name">${_escapeHtml(r.item.name)}</span>
    </div>`).join('');
}

function PaletteBody({ ui, entries, onClose }) {
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const fuse = new Fuse(entries, { keys: ['name'], threshold: 0.4, ignoreLocation: true });
    let activeIndex = 0;
    let results = entries.slice(0, MAX_RESULTS).map((item) => ({ item }));
    _renderResults(root, results, activeIndex);

    const input = root.querySelector('#cp-input');
    const commit = () => {
      const r = results[activeIndex];
      if (!r) return;
      onClose();
      try { _selectResult(ui, r.item); }
      catch (err) { logger.warn('UI', 'command-palette: select failed', err); }
    };
    const onInput = () => {
      const q = input.value.trim();
      results = q ? fuse.search(q, { limit: MAX_RESULTS }) : entries.slice(0, MAX_RESULTS).map((item) => ({ item }));
      activeIndex = 0;
      _renderResults(root, results, activeIndex);
    };
    const onKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(results.length - 1, activeIndex + 1);
        _renderResults(root, results, activeIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(0, activeIndex - 1);
        _renderResults(root, results, activeIndex);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      }
    };
    const onResultsClick = (e) => {
      const row = e.target.closest('[data-index]');
      if (!row) return;
      activeIndex = parseInt(row.dataset.index, 10);
      commit();
    };
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKeyDown);
    const list = root.querySelector('#cp-results');
    list.addEventListener('click', onResultsClick);
    return () => {
      input.removeEventListener('input', onInput);
      input.removeEventListener('keydown', onKeyDown);
      list.removeEventListener('click', onResultsClick);
    };
  }, []);

  return h('div', { ref: rootRef }, [
    h('input', {
      id: 'cp-input', type: 'text', class: 'form-input', placeholder: 'Search, or run a command…',
      'aria-label': 'Search the campaign, or run a command', autocomplete: 'off',
      'aria-controls': 'cp-results', 'aria-autocomplete': 'list',
    }),
    h('div', { id: 'cp-live', class: 'sr-only', 'aria-live': 'polite' }),
    // The list scrolls now that commands sit above the nouns, so it
    // needs its own tab stop: arrow keys are driven from the input,
    // but a keyboard user must still be able to reach and scroll it.
    h('div', {
      id: 'cp-results', role: 'listbox', 'aria-label': 'Search results',
      class: 'cp-results', tabindex: '0',
    }),
  ]);
}

export function showCommandPalette(ui) {
  const entries = [..._commandEntries(ui), ..._buildIndex(ui.state)];
  openModal((close) =>
    h(Modal, { id: PALETTE_ID, title: 'Search or run a command', maxWidth: '480px', autoFocusSelector: '#cp-input', onClose: close },
      // Never empty: the commands are always there, so a fresh
      // campaign opens on what it can do rather than on an apology.
      h(PaletteBody, { ui, entries, onClose: close }),
    ),
  );
}
