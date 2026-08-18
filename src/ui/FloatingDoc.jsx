/**
 * FloatingDoc.jsx - pop-up viewer for handouts AND pages.
 *
 * Replaces the previous two read surfaces (handout ModalFactory modal
 * and Pages right-edge drawer) with a single floating panel that:
 *   - is draggable from its title bar,
 *   - can be opened multiple times (different docs side-by-side),
 *   - doesn't block the underlying map / sheets,
 *   - shares a single rendering pipeline so handouts and pages can't
 *     drift on wikilink handling or chrome.
 *
 * Edit / delete still go through the existing form modals - pop-up
 * is read-only. Wikilink clicks inside the body delegate to the
 * appropriate `ui.show*Preview` handler or open another FloatingDoc
 * for the linked handout/page.
 */

import { h } from 'preact';
import { useEffect, useRef, useMemo, useState } from "preact/hooks";
import { openDocsSignal } from '../state/ui-signals.js';
import { handoutsSignal, pagesSignal, mapsSignal } from '../state/signals.js';
import { renderMarkdown } from '../utils/renderMarkdown.js';
import { renderWikilinks } from '../utils/wikilinks.js';
import { canEditPage } from '../state/reader.js';
import { dispatchRollWikilink } from './tables/wikilink.js';
import { dispatchMapWikilink } from './maps/wikilink.js';
import { markHandoutSeen } from './handouts-panel.js';
import { ensurePageThreadRoot } from '../utils/page-comments.js';
import { ThreadView } from './ThreadView.jsx';

// Stagger panel positions so multiple opens don't pile up exactly.
const STAGGER_PX = 24;

function pickInitialPosition(index) {
  return {
    x: Math.max(16, 80 + index * STAGGER_PX),
    y: Math.max(16, 60 + index * STAGGER_PX),
  };
}

function buildWikilinkRefs(ui) {
  const titleToId = new Map();
  for (const [id, ho] of ui.state.handouts.entries()) if (ho?.title) titleToId.set(ho.title, id);
  const pagesByTitle = new Map();
  for (const p of ui.state.pages.values()) if (p?.title) pagesByTitle.set(p.title, p.id);
  return {
    titleToId,
    tables: ui.state.tables,
    refs: {
      pagesByTitle,
      characters: ui.state.characters,
      npcs: ui.state.npcs,
      items: ui.state.items,
      spells: ui.state.spells,
      maps: ui.state.maps,
    },
  };
}

function handleWikilinkClick(ui, e) {
  const handoutLink = e.target.closest?.('a.wikilink[data-handout-id]');
  if (handoutLink) {
    e.preventDefault();
    ui.openDoc('handout', handoutLink.getAttribute('data-handout-id'));
    return;
  }
  const pageLink = e.target.closest?.('a.wikilink[data-page-id]');
  if (pageLink) {
    e.preventDefault();
    ui.openDoc('page', pageLink.getAttribute('data-page-id'));
    return;
  }
  const rollLink = e.target.closest?.('a.wikilink[data-roll-table]');
  if (rollLink) {
    e.preventDefault();
    e.stopPropagation();
    dispatchRollWikilink(ui, rollLink);
    return;
  }
  const mapLink = e.target.closest?.('a.wikilink[data-map-id]');
  if (mapLink) {
    e.preventDefault();
    e.stopPropagation();
    dispatchMapWikilink(ui, mapLink);
    return;
  }
  const previewLink = e.target.closest?.('a.wikilink[data-preview-kind]');
  if (previewLink) {
    e.preventDefault();
    const kind = previewLink.getAttribute('data-preview-kind');
    const id = previewLink.getAttribute('data-preview-id');
    ({
      character: ui.showCharacterPreview,
      npc:       ui.showNPCPreview,
      item:      ui.showItemPreview,
      spell:     ui.showSpellPreview,
    }[kind])?.(id);
  }
}

function HandoutBody({ ui, handout }) {
  handoutsSignal.value; // subscribe so cross-handout wikilinks re-resolve
  const wl = useMemo(() => buildWikilinkRefs(ui), [handoutsSignal.value, pagesSignal.value, mapsSignal.value]);
  const html = useMemo(
    () => renderWikilinks(renderMarkdown(handout.content || ''), wl.titleToId, wl.tables, wl.refs),
    [handout.content, wl],
  );
  return h('div', { class: 'floating-doc__body' }, [
    handout.image_url && h('img', {
      class: 'floating-doc__image',
      src: handout.image_url,
      alt: '',
    }),
    h('div', {
      class: 'markdown floating-doc__markdown',
      dangerouslySetInnerHTML: { __html: html },
      onClick: (e) => handleWikilinkClick(ui, e),
    }),
  ]);
}

function PageBody({ ui, page }) {
  handoutsSignal.value; pagesSignal.value; mapsSignal.value;
  const [commentsOpen, setCommentsOpen] = useState(false);
  const wl = useMemo(() => buildWikilinkRefs(ui), [handoutsSignal.value, pagesSignal.value, mapsSignal.value]);
  const html = useMemo(
    () => renderWikilinks(renderMarkdown(page.body || ''), wl.titleToId, wl.tables, wl.refs),
    [page.body, wl],
  );
  const mayEdit = canEditPage(ui.state, page);

  return h('div', { class: 'floating-doc__body' }, [
    h('div', { class: 'floating-doc__chips' }, [
      h('span', { class: 'chip' }, page.kind),
      h('span', { class: 'chip' }, page.visibility),
      h('span', { class: 'chip' }, `Edited ${new Date(page.updated_at).toLocaleDateString()}`),
    ]),
    h('div', {
      class: 'markdown floating-doc__markdown',
      dangerouslySetInnerHTML: { __html: html },
      onClick: (e) => handleWikilinkClick(ui, e),
    }),
    h('div', { class: 'floating-doc__footer' }, [
      mayEdit && h('button', {
        type: 'button',
        class: 'dbt dbt--sm',
        onClick: () => ui.showPageForm(page.id),
      }, 'Edit'),
      h('button', {
        type: 'button',
        class: 'dbt dbt--sm',
        onClick: async () => {
          if (!commentsOpen) {
            try { await ensurePageThreadRoot(ui.state, page.id); }
            catch (err) { ui._toast?.(`Comments: ${err.message}`, 'error'); return; }
          }
          setCommentsOpen((v) => !v);
        },
      }, commentsOpen ? 'Hide comments' : 'Show comments'),
    ]),
    commentsOpen && page.thread_root_event_id && h('div', {
      class: 'floating-doc__comments',
    }, h(ThreadView, { ui, rootEventId: page.thread_root_event_id })),
  ]);
}

function FloatingDoc({ ui, descriptor, index }) {
  const headerRef = useRef(null);
  const panelRef = useRef(null);
  const dragState = useRef({ active: false, dx: 0, dy: 0 });
  const initial = pickInitialPosition(index);
  const pos = useRef({ x: initial.x, y: initial.y });

  useEffect(() => {
    if (!panelRef.current) return;
    panelRef.current.style.left = `${pos.current.x}px`;
    panelRef.current.style.top  = `${pos.current.y}px`;
  }, [descriptor.key]);

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragState.current = {
      active: true,
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
    };
    headerRef.current?.setPointerCapture?.(e.pointerId);
    ui.bringDocToFront(descriptor.key);
  };
  const onPointerMove = (e) => {
    if (!dragState.current.active) return;
    const x = Math.max(0, e.clientX - dragState.current.dx);
    const y = Math.max(0, e.clientY - dragState.current.dy);
    pos.current = { x, y };
    if (panelRef.current) {
      panelRef.current.style.left = `${x}px`;
      panelRef.current.style.top  = `${y}px`;
    }
  };
  const onPointerUp = (e) => {
    dragState.current.active = false;
    headerRef.current?.releasePointerCapture?.(e.pointerId);
  };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') ui.closeDoc(descriptor.key);
  };

  // Keyboard-movable: mouse drag has no keyboard equivalent otherwise.
  const KEY_MOVE_PX = 16;
  const moveBy = (dx, dy) => {
    const x = Math.max(0, pos.current.x + dx);
    const y = Math.max(0, pos.current.y + dy);
    pos.current = { x, y };
    if (panelRef.current) {
      panelRef.current.style.left = `${x}px`;
      panelRef.current.style.top  = `${y}px`;
    }
  };
  const onHandleKeyDown = (e) => {
    const delta = {
      ArrowLeft: [-KEY_MOVE_PX, 0], ArrowRight: [KEY_MOVE_PX, 0],
      ArrowUp: [0, -KEY_MOVE_PX], ArrowDown: [0, KEY_MOVE_PX],
    }[e.key];
    if (!delta) return;
    e.preventDefault();
    e.stopPropagation();
    moveBy(delta[0], delta[1]);
  };

  // Resolve the target doc from state. Re-evaluated on every render so
  // a remote edit shows up automatically.
  handoutsSignal.value; pagesSignal.value;
  const handout = descriptor.kind === 'handout' ? ui.state.handouts.get(descriptor.id) : null;
  const page    = descriptor.kind === 'page'    ? ui.state.pages.get(descriptor.id)    : null;
  const doc = handout ?? page;

  if (!doc) {
    return h('aside', {
      ref: panelRef,
      class: 'floating-doc',
      style: `z-index:${descriptor.z}`,
      role: 'dialog',
      'aria-label': 'Document not found',
      tabindex: -1,
      onKeyDown,
      onMouseDown: () => ui.bringDocToFront(descriptor.key),
    }, [
      h('header', {
        ref: headerRef,
        class: 'floating-doc__header',
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel: onPointerUp,
      }, [
        h('button', {
        type: 'button',
        class: 'floating-doc__handle',
        'aria-label': 'Move document window (arrow keys)',
        title: 'Move window: drag, or focus and use arrow keys',
        onKeyDown: onHandleKeyDown,
      }, '⋮⋮'),
        h('span', { class: 'floating-doc__title' }, 'Document missing'),
        h('button', {
          type: 'button',
          class: 'floating-doc__close',
          'aria-label': 'Close',
          onClick: (e) => { e.stopPropagation(); ui.closeDoc(descriptor.key); },
        }, '×'),
      ]),
      h('div', { class: 'floating-doc__body' }, 'This document is no longer available.'),
    ]);
  }

  const title = handout?.title || page?.title || 'Untitled';
  const titleId = `floating-doc-title-${descriptor.key.replace(/[^a-z0-9]/gi, '-')}`;

  return h('aside', {
    ref: panelRef,
    class: 'floating-doc',
    style: `z-index:${descriptor.z}`,
    role: 'dialog',
    'aria-labelledby': titleId,
    tabindex: -1,
    onKeyDown,
    onMouseDown: () => ui.bringDocToFront(descriptor.key),
  }, [
    h('header', {
      ref: headerRef,
      class: 'floating-doc__header',
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    }, [
      h('button', {
        type: 'button',
        class: 'floating-doc__handle',
        'aria-label': 'Move document window (arrow keys)',
        title: 'Move window: drag, or focus and use arrow keys',
        onKeyDown: onHandleKeyDown,
      }, '⋮⋮'),
      h('span', { id: titleId, class: 'floating-doc__title' }, title),
      h('button', {
        type: 'button',
        class: 'floating-doc__close',
        'aria-label': 'Close',
        onClick: (e) => { e.stopPropagation(); ui.closeDoc(descriptor.key); },
      }, '×'),
    ]),
    handout
      ? h(HandoutBody, { ui, handout })
      : h(PageBody, { ui, page }),
  ]);
}

export function FloatingDocs({ ui }) {
  const docs = openDocsSignal.value;
  handoutsSignal.value; pagesSignal.value;

  // Close docs whose backing handout/page has been deleted. Only docs
  // that resolved at least once close automatically; a doc opened
  // before sync delivers its content keeps the placeholder. Skipped
  // during sync refreshes: loadInitialState clears every collection
  // before the snapshot refills, and that gap must not eat open docs.
  const resolvedRef = useRef(new Set());
  useEffect(() => {
    if (ui.state.refreshing) return;
    for (const d of docs) {
      const exists = d.kind === 'handout'
        ? ui.state.handouts.has(d.id)
        : ui.state.pages.has(d.id);
      if (exists) {
        resolvedRef.current.add(d.key);
      } else if (resolvedRef.current.has(d.key)) {
        resolvedRef.current.delete(d.key);
        closeDoc(d.key);
      }
    }
  });

  // Mark handouts seen on the side-effect tick after open so the
  // "NEW" badge clears on next list re-render.
  useEffect(() => {
    for (const d of docs) if (d.kind === 'handout') markHandoutSeen(d.id);
  }, [docs.length, docs.map((d) => d.key).join('|')]);

  if (!docs.length) return null;

  return h('div', { class: 'floating-docs', 'aria-live': 'polite' },
    docs.map((d, i) => h(FloatingDoc, { key: d.key, ui, descriptor: d, index: i })),
  );
}

let _zCounter = 100;

export function openDoc(kind, id) {
  const key = `${kind}:${id}`;
  const list = openDocsSignal.value;
  const existing = list.find((d) => d.key === key);
  if (existing) {
    // Already open - just bring to front.
    bringDocToFront(key);
    return;
  }
  _zCounter += 1;
  openDocsSignal.value = [...list, { key, kind, id, z: _zCounter }];
}

export function closeDoc(key) {
  openDocsSignal.value = openDocsSignal.value.filter((d) => d.key !== key);
}

export function closeAllDocs() {
  openDocsSignal.value = [];
}

export function bringDocToFront(key) {
  const list = openDocsSignal.value;
  const item = list.find((d) => d.key === key);
  if (!item) return;
  if (item.z === _zCounter) return;
  _zCounter += 1;
  openDocsSignal.value = list.map((d) => d.key === key ? { ...d, z: _zCounter } : d);
}
