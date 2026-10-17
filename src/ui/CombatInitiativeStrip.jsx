/**
 * CombatInitiativeStrip.jsx - slim horizontal turn-order strip pinned
 * beneath the map in Combat mode.
 *
 * Each combatant: 7px color dot (or token avatar later) + name + HP
 * fraction + a 3px HP bar in the token color. Active combatant gets
 * `background: --color-background-warning` (matches matrix_vtt_mockup
 * `.ie.cur`). GM gets a small `End Turn` button at the right edge.
 *
 * Pure presentation read from initiativeSignal + tokensSignal. Replaces
 * the old InitiativeBar in Combat mode (which has been unmounted there
 * since the cohesion pass).
 */

import { h } from 'preact';
import { initiativeSignal, tokensSignal } from '../state/signals.js';
import { Avatar } from './Avatar.jsx';
import { EndCombatIcon } from './icons/index.jsx';

function HpBar({ entry, color }) {
  const hp = Number(entry?.hp_current ?? 0);
  const max = Number(entry?.hp_max ?? 0);
  const pct = max > 0 ? Math.max(0, Math.min(100, (hp / max) * 100)) : 0;
  const zone = pct > 50 ? 'healthy' : pct > 25 ? 'bloodied' : 'critical';
  return h('div', {
    class: 'combat-init-strip__hpbar combat-init-strip__hp-bar',
    role: 'meter',
    'aria-label': 'HP',
    'aria-valuenow': hp,
    'aria-valuemin': 0,
    'aria-valuemax': max,
    'data-zone': zone,
  },
    h('div', {
      class: 'combat-init-strip__hpbar-fill',
      style: `width:${pct}%;background:${color};`,
    }),
  );
}

export function CombatInitiativeStrip({ ui }) {
  initiativeSignal.value;
  tokensSignal.value;

  const init = ui?.state?.initiative;
  if (!init?.active) return null;

  const { order = [], current_index, round } = init;
  const isGM = typeof ui?.state?.isGM === 'function' ? ui.state.isGM() : false;
  const myTurn = typeof ui?._isMyCombatTurn === 'function' ? ui._isMyCombatTurn() : false;
  const canEndTurn = isGM || myTurn;

  return h('div', {
    class: 'combat-init-strip',
    role: 'group',
    'aria-label': 'Initiative order',
  }, [
    h('div', { class: 'combat-init-strip__meta' }, [
      h('span', { class: 'combat-init-strip__round' }, `R${round || 1}`),
      h('span', { id: 'turn-timer', class: 'turn-timer combat-init-strip__timer' }, '0:00'),
    ]),
    h('ol', { class: 'combat-init-strip__list', role: 'list' },
      order.map((entry, i) => {
        const token = entry?.token_id ? ui.state.tokens.get(entry.token_id) : null;
        const color = token?.color || 'var(--color-text-tertiary)';
        return h('li', {
          key: entry.token_id || `${entry.name || 'unknown'}-${entry.initiative ?? i}`,
          class: 'combat-init-strip__row',
          'data-current': String(i === current_index),
          'aria-current': i === current_index ? 'true' : 'false',
        }, [
          h(Avatar, {
            imageUrl: token?.image_url,
            name: entry.name,
            color,
            size: 20,
          }),
          h('span', { class: 'combat-init-strip__name' }, entry.name || '-'),
          entry.hp_max != null && h('span', { class: 'combat-init-strip__hp' },
            `${entry.hp_current ?? '?'}/${entry.hp_max}`),
          entry.hp_max != null && h(HpBar, { entry, color }),
        ]);
      }),
    ),
    h('div', { class: 'combat-init-strip__actions' }, [
      canEndTurn && h('button', {
        type: 'button',
        class: 'dbt combat-init-strip__end-turn',
        'data-action': 'end-turn',
        'aria-label': 'End turn',
        title: 'End turn',
        onClick: () => ui.nextTurn?.(),
      }, 'End Turn'),
      isGM && h('button', {
        type: 'button',
        class: 'dbt dbt--compact combat-init-strip__stop-btn',
        'aria-label': 'End combat',
        title: 'End combat',
        onClick: () => ui.endCombat?.(),
      }, h(EndCombatIcon, {})),
    ]),
  ]);
}
