
import { h } from 'preact';
import { initiativeSignal } from '../state/signals.js';
import { PlayIcon } from './icons/index.jsx';

/**
 * The two actions a player reaches for mid-turn. Speaking mode is not
 * one of them - the composer's Say / Describe / OOC pills are the one
 * place it changes, and the slash commands are the keyboard path.
 *
 * @param {{ ui: any }} props
 */
export function QuickTray({ ui }) {
  // Subscribe so the turn button rerenders on combat start / end.
  const init = initiativeSignal.value;
  const combatActive = !!init?.active;
  return h('div', {
    class: 'quick-tray',
    role: 'toolbar',
    'aria-label': 'Quick actions',
    'data-quick-tray': '',
  }, [
    h('button', {
      key: 'd20',
      type: 'button',
      class: 'quick-tray__btn',
      'data-quick': 'd20',
      title: 'Roll d20',
      'aria-label': 'Roll d20',
      onClick: () => ui.rollDice?.('d20'),
    }, 'd20'),
    h('button', {
      key: 'n',
      type: 'button',
      class: 'quick-tray__btn',
      'data-quick': 'next-turn',
      title: combatActive ? 'Next turn' : 'No active combat',
      'aria-label': 'Next turn',
      disabled: !combatActive,
      onClick: () => { if (combatActive) ui.nextTurn?.(); },
    }, h(PlayIcon, {})),
  ]);
}
