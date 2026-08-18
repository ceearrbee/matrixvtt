/**
 * Handouts.jsx - Notes tab. Lists handouts (filtered by visibility) with
 * GM edit/toggle/delete controls.
 */

import { h } from 'preact';
import { EditIcon, TrashIcon } from './icons/index.jsx';
import { handoutsSignal, tablesSignal } from '../state/signals.js';
import { buildHandoutTree } from '../utils/handoutTree.js';
import { EmptyState } from './EmptyState.jsx';

function HandoutCard({ ui, id, handout, isGM }) {
  const visIcon = handout.visible_to_players ? '👁' : '🙈';
  const visLabel = handout.visible_to_players ? 'Visible to players' : 'Hidden from players';
  const excerpt = handout.content
    ? handout.content.substring(0, 120) + (handout.content.length > 120 ? '…' : '')
    : '';
  const onOpen = (e) => {
    if (e.target.closest('button')) return;
    ui.showHandoutModal(id);
  };
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.showHandoutModal(id); }
  };
  return h('div', {
    class: 'handout-card', role: 'button', tabindex: 0,
    'aria-label': `Handout: ${handout.title}. ${excerpt ? 'Preview: ' + excerpt : ''} Click to view.`,
    title: 'Click to view full handout',
    onClick: onOpen, onKeyDown: onKey,
  }, [
    handout.image_url && h('img', { class: 'handout-card__img', src: handout.image_url, alt: '' }),
    h('div', { class: 'handout-card__body' }, [
      h('div', { class: 'handout-card__title' }, handout.title),
      excerpt && h('div', { class: 'handout-card__excerpt' }, excerpt),
    ]),
    isGM && h('div', { class: 'handout-card__actions' }, [
      h('button', {
        class: 'dbt dbt--compact',
        title: 'Edit handout', 'aria-label': 'Edit handout',
        onClick: (e) => { e.stopPropagation(); ui.showHandoutForm(id); },
      }, h(EditIcon, {})),
      h('button', {
        class: 'dbt dbt--compact',
        title: visLabel, 'aria-label': visLabel,
        onClick: (e) => { e.stopPropagation(); ui.toggleHandoutVisibility(id); },
      }, visIcon),
      h('button', {
        class: 'dbt dbt--compact',
        title: 'Delete handout', 'aria-label': 'Delete handout',
        style: 'color:var(--color-text-danger)',
        onClick: (e) => { e.stopPropagation(); ui.deleteHandout(id); },
      }, h(TrashIcon, {})),
    ]),
  ]);
}

function HandoutNode({ ui, node, depth, isGM }) {
  return h('div', {
    class: 'handout-node',
    style: depth > 0 ? `padding-left: ${depth * 16}px; border-left: 2px solid var(--color-border-primary)` : '',
  }, [
    h(HandoutCard, { key: node.id, ui, id: node.id, handout: node, isGM }),
    node.children?.length > 0 && h('div', { class: 'handout-children' },
      node.children.map((child) => h(HandoutNode, { key: child.id, ui, node: child, depth: depth + 1, isGM }))
    ),
  ]);
}

export function Handouts({ ui }) {
  handoutsSignal.value; tablesSignal.value;
  const isGM = ui.state.isGM();

  const visibleHandouts = new Map(
    [...ui.state.handouts.entries()].filter(([, ho]) => isGM || ho.visible_to_players)
  );

  const tree = buildHandoutTree([...visibleHandouts.values()], { maxDepth: 3 });

  const addBtn = isGM && h('button', {
    class: 'dbt dbt--sm btn-primary',
    style: 'width:100%;margin-bottom:10px;',
    'aria-label': 'Add new handout', title: 'Add handout',
    onClick: () => ui.showHandoutForm(),
  }, '+ Add Handout');

  if (tree.length === 0) {
    return h('div', { style: 'padding:12px;' }, [
      addBtn,
      h(EmptyState, {
        message: 'No handouts yet.',
        cta: isGM ? { label: '+ Add Handout', onClick: () => ui.showHandoutForm() } : undefined,
      }),
    ]);
  }

  return h('div', { style: 'padding:12px;' }, [
    addBtn,
    ...tree.map((node) => h(HandoutNode, { key: node.id, ui, node, depth: 0, isGM })),
  ]);
}
