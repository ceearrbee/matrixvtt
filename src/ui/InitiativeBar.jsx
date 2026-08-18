
import { h } from 'preact';
import { useState } from 'preact/hooks';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { getHPPercentage } from '../utils/ui-helpers.js';
import { FOG_MODES } from '../utils/ui-constants.js';
import { initiativeSignal, tokensSignal } from '../state/signals.js';
import { InitiativeEntry } from './InitiativeEntry.jsx';
import { HelpIcon } from './HelpIcon.jsx';
import { StartCombatIcon, EndCombatIcon } from './icons/index.jsx';

const DEFAULT_ACTION_ECONOMY = [
  { key: 'action_used', label: 'A', title: 'Action' },
  { key: 'bonus_action_used', label: 'B', title: 'Bonus Action' },
  { key: 'reaction_used', label: 'R', title: 'Reaction' },
];

export function InitiativeBar({ ui }) {
  // Auto-subscribe to initiative + token state.
  initiativeSignal.value; tokensSignal.value;

  const { order = [], current_index, active, round } = ui.state.initiative;
  const isGM = ui.state.isGM();
  const myTurn = ui._isMyCombatTurn();
  // Single expanded-row id; clicking another row swaps which row is
  // expanded so only one inactive row is open at a time.
  const [expandedTokenId, setExpandedTokenId] = useState(null);
  const onExpand = (tokenId) => setExpandedTokenId((prev) => (prev === tokenId ? null : tokenId));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!active) {
    if (!isGM) return null;
    return h('aside', {
      class: 'initiative-panel initiative-panel--inactive',
      role: 'complementary',
      'aria-label': 'Initiative tracker (no combat)',
    }, [
      h('div', { class: 'resize-handle resize-handle--init', 'data-resize': 'init', 'aria-hidden': 'true' }),
      h('div', { class: 'initiative-panel__header' }, 'Combat'),
      h('div', { style: 'padding: 8px;' }, [
        h('div', { class: 'entity-subtitle', style: 'margin-bottom: 8px; font-style: italic;' }, 'No combat in progress'),
        h('button', {
          class: 'dbt btn-primary',
          style: 'width: 100%;',
          'aria-label': 'Start combat and roll initiative',
          title: 'Roll initiative for all tokens',
          onClick: () => ui.rollInitiative(),
        }, [h(StartCombatIcon, {}), ' Start Combat']),
      ]),
    ]);
  }

  const actionEconomy = ui.state.settings?.systemConfig?.action_economy ?? DEFAULT_ACTION_ECONOMY;
  // Read fog into a local so the two dependent field accesses share one
  // guard; if fog is null (mid-init, or cleared to default), both the
  // mode check and the revealed read fall through cleanly.
  const fog = ui.state.fog ?? { mode: null, revealed: [] };
  const fogRevealedSet = (!isGM && fog.mode === FOG_MODES.HIDDEN)
    ? new Set(fog.revealed || [])
    : null;

  const visible = order
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => {
      if (isGM) return true;
      const token = ui.state.tokens.get(entry.token_id);
      return !token || ui.state.isTokenVisibleToPlayer(token, fogRevealedSet);
    });

  const handleDragEnd = (event) => {
    const { active: dragged, over } = event;
    if (over && dragged.id !== over.id) {
      const oldIndex = visible.findIndex((v) => v.entry.token_id === dragged.id);
      const newIndex = visible.findIndex((v) => v.entry.token_id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        ui.reorderInitiative(visible[oldIndex].index, visible[newIndex].index);
      }
    }
  };

  return h('aside', {
    class: 'initiative-panel',
    role: 'complementary',
    'aria-label': 'Initiative tracker',
  }, [
    h('div', { class: 'resize-handle resize-handle--init', 'data-resize': 'init', 'aria-hidden': 'true' }),
    h('div', { class: 'initiative-panel__header' }, [
      h('span', null, [
        'Initiative ',
        h(HelpIcon, { term: 'initiative' }),
        ' ',
        active && h('span', { id: 'turn-timer', class: 'turn-timer' }, '0:00'),
      ]),
      isGM && active && h('button', {
        class: 'dbt dbt--compact',
        'aria-label': 'End combat', title: 'End combat',
        onClick: () => ui.endCombat(),
      }, h(EndCombatIcon, {})),
    ]),
    active && order.length > 0 && h('div', { class: 'initiative-round' }, `⚔ Round ${round || 1}`),
    h(DndContext, {
      sensors,
      collisionDetection: closestCenter,
      onDragEnd: handleDragEnd,
    }, [
      h(/** @type {any} */ (SortableContext), {
        items: visible.map(v => v.entry.token_id),
        strategy: verticalListSortingStrategy,
      }, [
        h('div', { class: 'initiative-entries', role: 'list' },
          visible.map(({ entry, index }) => h(InitiativeEntry, {
            key: entry.token_id,
            ui,
            entry,
            index,
            current_index,
            isGM,
            myTurn,
            actionEconomy,
            getHPPercentage,
            isExpanded: expandedTokenId === entry.token_id,
            onExpand,
          }))
        )
      ])
    ])
  ]);
}
