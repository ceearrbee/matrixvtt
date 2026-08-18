/**
 * InitiativeEntry.jsx - single row in the initiative tracker.
 */

import { h } from 'preact';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { COND_ICONS } from '../utils/conditions.js';
import { DISPOSITIONS } from '../utils/constants.js';
import { getHPColor, getHPZone } from '../utils/format.js';
import { tokensSignal, charactersSignal, npcsSignal } from '../state/signals.js';
import { ShieldIcon, CombatIcon, DiceIcon, RunIcon, PlayIcon } from './icons/index.jsx';

function movementLabel(ui, entry, token) {
  const mvmt = ui.state.settings?.systemConfig?.movement ?? {};
  const unitsPerCell = mvmt.unitsPerCell ?? 5;
  const defaultSpeed = mvmt.defaultSpeed ?? 30;
  const sheet = ui.state.characters.get(token.sheet_id) || ui.state.npcs.get(token.sheet_id);
  const maxCells = Math.floor((sheet?.speed ?? defaultSpeed) / unitsPerCell);
  const used = entry.movement_used ?? 0;
  return { remaining: maxCells - used, max: maxCells };
}

/**
 * Render a token's per-token trackers as small badges. Standalone so
 * it can be tested without the dnd-kit context InitiativeEntry needs.
 * Returns null when there are no trackers.
 */
export function TokenTrackerBadges({ trackers, ariaContext = 'Token' }) {
  if (!Array.isArray(trackers) || trackers.length === 0) return null;
  return h('div', {
    class: 'ie__trackers',
    role: 'group',
    'aria-label': `${ariaContext} trackers`,
  }, trackers.map((t, i) => {
    const max = typeof t?.max === 'number' ? t.max : null;
    const text = max != null ? `${t.value}/${max}` : String(t.value);
    return h('span', {
      key: i,
      class: 'ie__tracker',
      title: `${t.label}: ${text}`,
      'aria-label': `${t.label}: ${text}`,
    }, [
      h('span', { class: 'ie__tracker-label' }, t.label),
      ' ',
      h('span', { class: 'ie__tracker-value' }, text),
    ]);
  }));
}

export function InitiativeEntry({
  ui, entry, index, current_index, isGM, myTurn, actionEconomy,
  getHPPercentage, isExpanded = false, onExpand = null,
}) {
  tokensSignal.value; charactersSignal.value; npcsSignal.value;
  const token = ui.state.tokens.get(entry.token_id);
  const color = token?.color || '#666666';
  const disposition = token?.disposition || entry.side || DISPOSITIONS.NEUTRAL;
  const DispIcon = disposition === DISPOSITIONS.FRIENDLY ? ShieldIcon : disposition === DISPOSITIONS.HOSTILE ? CombatIcon : null;
  const hpPercent = getHPPercentage(entry);
  const isCurrent = index === current_index;
  const isDefeated = (entry.hp_current ?? 1) <= 0 && (entry.hp_max ?? 0) > 0;
  const conditions = token?.conditions || [];
  const condIcons = conditions.slice(0, 5).map(c => COND_ICONS[c] || c.charAt(0)).join(' ');
  const canControl = isCurrent && (isGM || myTurn);
  const myUserId = ui.state.widgetManager?.userId;
  const ownsToken = token?.owner_user_id && token.owner_user_id === myUserId;
  const needsRoll = entry.initiative == null && (isGM || ownsToken);
  const move = (isCurrent && myTurn && token) ? movementLabel(ui, entry, token) : null;
  // Collapse-by-default is the standard. Inactive rows show name + init
  // + HP bar; everything else (AC, conditions, movement, HP nudgers,
  // set-turn, remove) lives behind an explicit chevron toggle. Active
  // and expanded rows show the full layout.
  const isCompact = !isCurrent && !isExpanded;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.token_id, disabled: !isGM });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { opacity: 0.5, zIndex: 1, position: 'relative' } : {}),
  };

  const onEntryClick = (e) => {
    if (e.target.closest('button') || e.target.hasAttribute('contenteditable')) return;
    if (typeof ui.previewToken === 'function') ui.previewToken(entry.token_id);
    else ui._selectTokenAndSwitchTab(entry.token_id);
  };

  const onKeyDown = (e) => {
    if (!isGM) return;
    const count = ui.state.initiative.order.length;
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      ui.reorderInitiative(index, index - 1);
    } else if (e.key === 'ArrowDown' && index < count - 1) {
      e.preventDefault();
      ui.reorderInitiative(index, index + 1);
    }
  };

  const onInitBlur = (e) => ui.setInitiativeRoll(index, e.target.textContent?.trim());

  return h('div', { style: 'display:contents' }, [
    (isCurrent && myTurn) && h('div', { class: 'your-turn-banner', 'aria-live': 'assertive' }, 'Your turn'),
    h('div', {
      class: `ie ${isCurrent ? 'cur' : ''} ${isDefeated ? 'ie--defeated' : ''}`,
      ref: setNodeRef,
      style,
      'data-token-id': entry.token_id,
      'data-index': index,
      tabindex: 0,
      role: 'listitem',
      ...(isCurrent ? { 'aria-current': 'step' } : {}),
      'aria-label': `${entry.name}, initiative ${entry.initiative ?? '?'}${isCurrent ? ', current turn' : ''}${isDefeated ? ', defeated' : ''}.`,
      onClick: onEntryClick,
      onKeyDown,
      ...attributes,
      ...listeners,
    }, [
      h('div', { class: 'ie__header' }, [
        h('div', { class: 'ie__dot', style: `background:${color}`, 'aria-hidden': 'true' }),
        h('span', { class: `ie__name ${isCurrent ? 'ie__name--current' : ''}`, title: `Disposition: ${disposition}` }, [
          DispIcon && h(DispIcon, {}),
          DispIcon ? ' ' : '',
          `${isDefeated ? '💀 ' : ''}${entry.name}`,
          isDefeated && h('span', { class: 'ie__defeated-label', 'aria-hidden': 'true' }, ' (defeated)'),
        ]),
        needsRoll
          ? h('button', { class: 'ie__init ie__roll-init', title: 'Roll initiative', onClick: (e) => { e.stopPropagation(); ui.rollMyInitiative(entry.token_id); } }, [h(DiceIcon, {}), ' Roll'])
          : isGM
            ? h('span', { class: 'ie__init', contentEditable: true, 'data-init-roll': true, 'data-index': index, title: 'Click to edit', onBlur: onInitBlur, onPointerDown: (e) => e.stopPropagation() }, String(entry.initiative ?? '?'))
            : h('span', { class: 'ie__init' }, String(entry.initiative ?? '-')),
      ]),
      h('div', { class: 'ie__body' }, [
        h('span', { class: 'ie__hp-text' }, `${entry.hp_current ?? '?'}/${entry.hp_max ?? '?'}`),
        h('div', {
          class: 'ie__hp-bar', role: 'meter',
          'aria-label': `${entry.name} HP`,
          'aria-valuenow': entry.hp_current ?? 0,
          'aria-valuemin': 0,
          'aria-valuemax': entry.hp_max || 1,
          style: 'flex:1',
        }, h('div', {
          class: 'ie__hp-fill',
          'data-zone': getHPZone(entry),
          style: `width:${hpPercent}%;background:${getHPColor(hpPercent)}`,
        })),
        !isCompact && token?.ac != null && token.ac !== '' && h('span', { class: 'ie__ac' }, `AC ${token.ac}`),
        !isCompact && move && h('span', { class: 'ie__move', title: 'Movement remaining this turn', 'aria-label': `${move.remaining} of ${move.max} movement cells remaining` }, [h(RunIcon, {}), ` ${move.remaining}/${move.max}`]),
        !isCompact && condIcons && h('span', { class: 'ie__conditions', title: conditions.join(', ') }, condIcons),
        !isCompact && h(TokenTrackerBadges, { trackers: token?.trackers, ariaContext: entry.name }),
        !isCompact && isGM && h('div', { class: 'ie__hp-adjust', role: 'group', 'aria-label': `Adjust ${entry.name} HP` },
          (isCurrent ? [-5, -1, 1, 5] : [-1, 1]).map((delta) => h('button', {
            key: `hp${delta}`,
            class: 'ie__hp-adjust-btn',
            'aria-label': `${delta > 0 ? 'Heal' : 'Damage'} ${Math.abs(delta)}`,
            title: `${delta > 0 ? '+' : ''}${delta} HP`,
            onClick: (e) => { e.stopPropagation(); ui.adjustTokenHP?.(entry.token_id, delta); },
            onPointerDown: (e) => e.stopPropagation(),
          }, `${delta > 0 ? '+' : ''}${delta}`))),
        !isCompact && isGM && !isCurrent && h('button', { class: 'ie__set-turn', 'data-set-turn': true, 'data-index': index, 'aria-label': `Jump to ${entry.name}'s turn`, onClick: (e) => { e.stopPropagation(); ui.setTurn(index); }, onPointerDown: (e) => e.stopPropagation() }, h(PlayIcon, {})),
        !isCompact && isGM && h('button', { class: 'ie__remove', 'aria-label': 'Remove from initiative', onClick: (e) => { e.stopPropagation(); ui.removeFromInitiative(entry.token_id); }, onPointerDown: (e) => e.stopPropagation() }, '×'),
        // Chevron toggle: inactive rows collapse to name + HP by
        // default; click reveals the rest (AC, conditions, HP nudgers,
        // etc.). Active rows hide the chevron since they always show
        // the full body.
        !isCurrent && typeof onExpand === 'function' && h('button', {
          class: 'ie__expand-toggle',
          'aria-expanded': String(isExpanded),
          'aria-label': isExpanded ? `Collapse ${entry.name} details` : `Expand ${entry.name} details`,
          title: isExpanded ? 'Hide details' : 'Show details',
          onClick: (e) => { e.stopPropagation(); onExpand(entry.token_id); },
          onPointerDown: (e) => e.stopPropagation(),
        }, isExpanded ? '▴' : '▾'),
      ]),
      canControl && h('div', { class: 'ie__action-row' }, [
        ...actionEconomy.map(ae => h('button', {
          key: ae.key,
          class: `ie__action-pip${entry[ae.key] ? ' ie__action-pip--used' : ''}`,
          'aria-pressed': String(!!entry[ae.key]),
          title: ae.title,
          onClick: (e) => { e.stopPropagation(); ui.toggleCombatAction(ae.key); },
          onPointerDown: (e) => e.stopPropagation(),
        }, ae.label)),
        h('button', { class: 'ie__end-turn', 'aria-label': 'End turn', onClick: (e) => { e.stopPropagation(); ui.nextTurn(); }, onPointerDown: (e) => e.stopPropagation() }, [h(PlayIcon, {}), ' End']),
      ]),
    ]),
  ]);
}
