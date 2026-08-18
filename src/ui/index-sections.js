/**
 * index-sections.js - shared navigation drawer bodies.
 *
 * The Scenes / Journal / NPCs / Items / Maps drawers are used in two places:
 * the slim `IconRail` (one drawer at a time, mobile) and the always-expanded
 * `LeftIndex` (every section at once, desktop Almanac shell). The bodies are
 * wired to Matrix state via signals + reader, so they live here once and both
 * shells import them rather than duplicating the wiring.
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import {
  activeChannelSignal, logVersionSignal,
} from '../state/ui-signals.js';
import {
  handoutsSignal, pagesSignal, npcsSignal, itemsSignal,
} from '../state/signals.js';
import { CHANNEL_KEYS, TABS, PAGE_KINDS } from '../utils/constants.js';
import { getVisiblePages } from '../state/reader.js';
import { openDoc } from './FloatingDoc.jsx';
import { Avatar } from './Avatar.jsx';
import { EmptyState } from './EmptyState.jsx';
import { showSceneStartModal } from './SceneStartModal.js';

function displayNameFor(sender) {
  if (!sender) return 'Someone';
  const idx = sender.indexOf(':');
  return idx > 1 ? sender.slice(1, idx) : sender;
}

export function ScenesDrawer({ ui }) {
  logVersionSignal.value;
  const scenes = (ui?.activityLog || []).filter((e) => e?.isSceneRoot && e.eventId);
  if (scenes.length === 0) {
    return h(EmptyState, {
      glyph: '🎬',
      title: 'No scene threads started',
      body: 'A scene threads chat under a story beat (e.g. "The throne room confrontation"). Pages and handouts live in the Journal drawer.',
      cta: { label: 'Start a scene', onClick: () => showSceneStartModal(ui) },
    });
  }
  const select = (channel) => () => { activeChannelSignal.value = channel; };
  return h('ul', { class: 'icon-rail__list', role: 'list' },
    scenes.map((s) => h('li', { key: s.eventId },
      h('button', {
        type: 'button',
        class: 'icon-rail__row',
        onClick: select(`${CHANNEL_KEYS.SCENE_PREFIX}${s.eventId}`),
      }, [
        h('span', { class: 'icon-rail__row-title' }, s.sceneTitle || 'Untitled scene'),
        h('span', { class: 'icon-rail__row-meta' }, displayNameFor(s.sender)),
      ]),
    )),
  );
}

export const JOURNAL_CATEGORIES = [
  { key: 'handouts', label: 'Handouts',  match: () => null /* handouts handled separately */ },
  { key: 'journal',  label: 'Journal',   match: (p) => p.kind === PAGE_KINDS.JOURNAL },
  { key: 'lore',     label: 'Lore',      match: (p) => p.kind === PAGE_KINDS.LORE },
  { key: 'fiction',  label: 'Fiction',   match: (p) => p.kind === PAGE_KINDS.FICTION },
  { key: 'prep',     label: 'Prep',      match: (p) => p.kind === PAGE_KINDS.PREP, gmOnly: true },
];

export function JournalSection({ label, count, isOpen, onToggle, children }) {
  return h('div', { class: 'icon-rail__section', 'data-section': label.toLowerCase() }, [
    h('button', {
      type: 'button',
      class: 'icon-rail__section-head',
      'aria-expanded': String(isOpen),
      onClick: onToggle,
    }, [
      h('span', { class: 'icon-rail__chevron', 'aria-hidden': 'true' }, isOpen ? '▾' : '▸'),
      h('span', { class: 'icon-rail__section-label' }, label),
      h('span', { class: 'icon-rail__section-count' }, String(count)),
    ]),
    isOpen && h('ul', { class: 'icon-rail__list', role: 'list' }, children),
  ]);
}

export function JournalDrawer({ ui }) {
  handoutsSignal.value; pagesSignal.value;
  const isGM = typeof ui?.state?.isGM === 'function' ? ui.state.isGM() : false;
  const handouts = ui?.state?.handouts
    ? [...ui.state.handouts.values()].filter((ho) => ho && (isGM || ho.visible_to_players))
    : [];
  let pages = [];
  try { if (ui?.state) pages = getVisiblePages(ui.state); } catch { /* fall back to [] */ }

  // Default: Handouts + Journal open, others collapsed. State is
  // component-local - survives drawer-close/reopen via the parent's
  // mount stability but not across page reloads, which keeps the
  // surface uncluttered without needing persistent storage churn.
  const [openSections, setOpenSections] = useState({
    handouts: true, journal: true, lore: false, fiction: false, prep: false,
  });
  const toggle = (key) => () =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  if (handouts.length === 0 && pages.length === 0) {
    return h(EmptyState, {
      glyph: '📖',
      title: 'No journal entries yet',
      body: 'Handouts (letters, maps, notes) and long-form pages (journals, lore, fiction) live here.',
      // `showHandoutForm` is the wired entry point (modal-wiring.js); the old
      // `openHandoutsPanel` was never defined, so this CTA never rendered -
      // leaving GMs with no way to author a handout in the almanac shell.
      cta: ui?.showHandoutForm
        ? { label: 'Add a handout', onClick: () => ui.showHandoutForm() }
        : null,
    });
  }

  const handoutRow = (ho) => h('li', { key: `h-${ho.id}` },
    h('button', {
      type: 'button',
      class: 'icon-rail__row',
      onClick: () => openDoc('handout', ho.id),
    }, [
      h('span', { class: 'icon-rail__row-title' }, ho.title || 'Untitled handout'),
    ]),
  );
  const pageRow = (pg) => h('li', { key: `p-${pg.id}` },
    h('button', {
      type: 'button',
      class: 'icon-rail__row',
      onClick: () => openDoc('page', pg.id),
    }, [
      h('span', { class: 'icon-rail__row-title' }, pg.title || 'Untitled page'),
    ]),
  );

  return h('div', { class: 'icon-rail__sections' },
    JOURNAL_CATEGORIES.flatMap((cat) => {
      if (cat.gmOnly && !isGM) return [];
      const items = cat.key === 'handouts'
        ? handouts
        : pages.filter((p) => cat.match(p));
      if (items.length === 0) return [];
      const rows = cat.key === 'handouts'
        ? items.map(handoutRow)
        : items.map(pageRow);
      return [h(JournalSection, {
        key: cat.key,
        label: cat.label,
        count: items.length,
        isOpen: !!openSections[cat.key],
        onToggle: toggle(cat.key),
        children: rows,
      })];
    }),
  );
}

export function NPCsDrawer({ ui }) {
  npcsSignal.value;
  const npcs = ui?.state?.npcs ? [...ui.state.npcs.values()] : [];
  if (npcs.length === 0) {
    return h(EmptyState, {
      glyph: '👤',
      title: 'No NPCs yet',
      body: 'NPCs you create here become available as tokens, encounter rosters, and dialogue speakers.',
      cta: ui?.createNPC ? { label: 'Create an NPC', onClick: () => ui.createNPC() } : null,
    });
  }
  const pick = (id) => () => {
    ui.selectNPCById?.(id);
    ui.switchTab?.(TABS.NPC);
  };
  return h('ul', { class: 'icon-rail__list', role: 'list' },
    npcs.map((n) => h('li', { key: n.id },
      h('button', {
        type: 'button',
        class: 'icon-rail__row icon-rail__row--with-avatar',
        onClick: pick(n.id),
      }, [
        h(Avatar, { imageUrl: n.image_url, name: n.name, color: n.color, size: 24 }),
        h('span', { class: 'icon-rail__row-body' }, [
          h('span', { class: 'icon-rail__row-title' }, n.name || 'Unnamed NPC'),
          n.cr != null && h('span', { class: 'icon-rail__row-meta' }, `CR ${n.cr}`),
        ]),
      ]),
    )),
  );
}

export function ItemsDrawer({ ui }) {
  itemsSignal.value;
  const items = ui?.state?.items ? [...ui.state.items.values()] : [];
  if (items.length === 0) {
    return h(EmptyState, {
      glyph: '📦',
      title: 'No items yet',
      body: 'Catalogue weapons, armor, consumables, and magic items. Drag-and-drop into character inventories.',
      cta: ui?.createItem ? { label: 'Add an item', onClick: () => ui.createItem() } : null,
    });
  }
  const pick = () => ui.switchTab?.(TABS.ITEMS);
  return h('ul', { class: 'icon-rail__list', role: 'list' },
    items.slice(0, 50).map((it) => h('li', { key: it.id },
      h('button', {
        type: 'button',
        class: 'icon-rail__row',
        onClick: pick,
      }, [
        h('span', { class: 'icon-rail__row-title' }, it.name || 'Unnamed item'),
        it.kind && h('span', { class: 'icon-rail__row-meta' }, it.kind),
      ]),
    )),
  );
}

