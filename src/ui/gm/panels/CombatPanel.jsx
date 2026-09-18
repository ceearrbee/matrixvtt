import { h } from 'preact';

export function CombatPanel({ ui, gm }) {
  return h('div', { class: 'gm-panel gm-panel--combat', style: 'padding:var(--space-xl);' }, [
    h('div', { class: 'button-group', style: 'margin-bottom:var(--space-lg);' }, [
      h(
        'button',
        {
          class: 'dbt',
          'aria-label': 'Roll initiative for all combatants',
          title: 'Roll initiative',
          onClick: () => ui.rollInitiative(),
        },
        'Roll Initiative'
      ),
      h(
        'button',
        {
          class: 'dbt',
          'aria-label': 'Previous turn',
          title: 'Previous turn',
          onClick: () => ui.prevTurn(),
        },
        'Previous turn'
      ),
      h(
        'button',
        {
          class: 'dbt',
          'aria-label': 'Next turn',
          title: 'Next turn',
          onClick: () => ui.nextTurn(),
        },
        'Next turn'
      ),
      h(
        'button',
        {
          class: 'dbt',
          'aria-label': 'End combat and clear tracker',
          title: 'End combat',
          onClick: () => ui.endCombat(),
        },
        'End Combat'
      ),
    ]),
    h('div', { class: 'button-group' }, [
      h(
        'button',
        {
          class: 'dbt',
          'aria-label': 'Restore all tokens to full HP',
          title: 'Heal all tokens',
          onClick: () => gm.healAll(),
        },
        'Heal All'
      ),
      h(
        'button',
        {
          class: 'dbt',
          'aria-label': 'Clear conditions from all tokens',
          title: 'Clear all conditions',
          onClick: () => gm.clearAllConditions(),
        },
        'Clear Conditions'
      ),
    ]),
  ]);
}
