
import { h } from 'preact';
import { chatModeSignal } from '../state/ui-signals.js';
import { initiativeSignal } from '../state/signals.js';
import { PlayIcon } from './icons/index.jsx';

/**
 * @param {{ ui: any }} props
 */
export function QuickTray({ ui }) {
  // Subscribe so the buttons rerender on mode flip / combat start.
  const mode = chatModeSignal.value;
  const init = initiativeSignal.value;
  const combatActive = !!init?.active;
  const modeLabel = mode === 'ooc' ? 'OOC' : 'IC';
  const toggleMode = () => {
    chatModeSignal.value = mode === 'ooc' ? 'say' : 'ooc';
  };
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
    h('button', {
      key: 't',
      type: 'button',
      class: 'quick-tray__btn',
      'data-quick': 'mode-toggle',
      title: 'Toggle IC / OOC',
      'aria-label': `Switch to ${modeLabel === 'OOC' ? 'IC' : 'OOC'}`,
      'aria-pressed': mode === 'ooc' ? 'true' : 'false',
      onClick: toggleMode,
    }, modeLabel),
  ]);
}
