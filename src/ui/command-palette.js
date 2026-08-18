/**
 * Cmd-K-style command palette: a single fuzzy search across every
 * named entity in the campaign (tokens, characters, NPCs, items,
 * spells, handouts, pins). Opens on `/` from the global keymap; pick
 * a result with arrows + Enter, jump to the contextual action for
 * that entity's type (pan-to-token, open-sheet, scroll-to-item, …).
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
import { emptyStateHtml } from './empty-state-html.js';

const PALETTE_ID = 'command-palette';
const MAX_RESULTS = 12;

const TYPE_LABELS = {
  token: '🪙 Token',
  character: '🧙 Character',
  npc: '🐺 NPC',
  item: '🗝 Item',
  spell: '✨ Spell',
  handout: '📜 Handout',
  pin: '📌 Pin',
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
  push('pin',       state.pins);
  return entries;
}

function _selectResult(ui, entry) {
  switch (entry.kind) {
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

function EmptyPalette({ ui, onClose }) {
  const rootRef = useRef(null);
  useLayoutEffect(() => {
    const cta = rootRef.current?.querySelector('[data-empty-cta="add-character"]');
    const handler = () => { onClose(); ui.showCharacterWizard?.(); };
    cta?.addEventListener('click', handler);
    return () => cta?.removeEventListener('click', handler);
  }, []);
  return h('div', {
    ref: rootRef,
    dangerouslySetInnerHTML: {
      __html: emptyStateHtml('Nothing to search yet.', { label: '+ Add Character', action: 'add-character' }),
    },
  });
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
      id: 'cp-input', type: 'text', class: 'form-input', placeholder: 'Search tokens, characters, items…',
      'aria-label': 'Search tokens, characters, items', autocomplete: 'off',
      'aria-controls': 'cp-results', 'aria-autocomplete': 'list',
    }),
    h('div', { id: 'cp-live', class: 'sr-only', 'aria-live': 'polite' }),
    h('div', { id: 'cp-results', role: 'listbox', 'aria-label': 'Search results', class: 'cp-results' }),
  ]);
}

export function showCommandPalette(ui) {
  const entries = _buildIndex(ui.state);
  openModal((close) =>
    h(Modal, { id: PALETTE_ID, title: 'Search', maxWidth: '480px', autoFocusSelector: '#cp-input', onClose: close },
      entries.length === 0
        ? h(EmptyPalette, { ui, onClose: close })
        : h(PaletteBody, { ui, entries, onClose: close }),
    ),
  );
}
