/**
 * composer/dice-controls.jsx - the composer's dice and speaking-mode
 * controls, declared once.
 *
 * The desktop strip lays these out in a single flex row inside
 * `.dice-bar`; the phone popover stacks them in labelled sections. Both
 * used to declare their own dice faces, mode list, modifier row and
 * extra-roll buttons - about sixteen duplicated declarations that drifted
 * apart. The layouts still differ; the controls do not.
 */

import { h } from 'preact';
import { secretRollSignal, chatModeSignal, diceMacrosSignal } from '../../state/ui-signals.js';
import { HelpIcon } from '../HelpIcon.jsx';
import { WhisperIcon, StarIcon } from '../icons/index.jsx';

const DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];

const CHAT_MODES = [
  { id: 'say', label: 'Say', title: 'Speak in character' },
  { id: 'describe', label: 'Describe', title: 'Describe an action in the third person' },
  { id: 'ooc', label: 'OOC', title: 'Speak as yourself, out of character' },
];

/** One button per die face. `size` picks the strip or the popover metrics. */
export function DiceButtons({ ui, selected, onSelect, size = '' }) {
  return DICE.map((d) => h('button', {
    key: d,
    type: 'button',
    class: `dbt${size}${selected === d ? ' dbt--active' : ''}`,
    'data-dice': d,
    'aria-label': `Roll ${d}`,
    title: `Roll ${d}`,
    onClick: () => { onSelect?.(d); ui.rollDice?.(d); },
  }, d));
}

/** Modifier field plus the Roll button that applies it to the selection. */
export function ModifierRow({ ui, selected, size = '' }) {
  return [
    h('label', { key: 'l', for: 'dice-modifier', class: 'dice-bar__mod-label', title: 'Dice modifier' }, 'mod'),
    h('input', {
      key: 'i', type: 'number', id: 'dice-modifier', class: 'dice-bar__mod-input',
      defaultValue: 0, 'aria-label': 'Dice modifier', title: 'Dice modifier',
    }),
    h('button', {
      key: 'r', type: 'button', class: `dbt${size}`, id: 'roll-dice',
      'aria-label': 'Roll selected die with modifier', title: 'Roll dice',
      onClick: () => ui.rollDice?.(selected),
    }, 'Roll'),
  ];
}

/** Advantage / disadvantage / secret / save-macro / macro list. */
export function ExtraRolls({ ui, size = '' }) {
  const rolls = ui.state?.settings?.systemConfig?.rolls ?? {};
  const secret = secretRollSignal.value;
  const macros = diceMacrosSignal.value;
  return [
    rolls.advantage && h('button', {
      key: 'adv', type: 'button', class: `dbt${size}`, id: 'adv-roll-btn',
      title: 'Roll with advantage', 'aria-label': 'Roll with advantage',
      onClick: () => ui.rollWithAdvantage?.(),
    }, 'Adv'),
    rolls.disadvantage && h('button', {
      key: 'dis', type: 'button', class: `dbt${size}`, id: 'dis-roll-btn',
      title: 'Roll with disadvantage', 'aria-label': 'Roll with disadvantage',
      onClick: () => ui.rollWithDisadvantage?.(),
    }, 'Dis'),
    h('button', {
      key: 'secret', type: 'button',
      class: `dbt${size}${secret ? ' dbt--active' : ''}`, id: 'secret-roll-btn',
      title: 'Roll privately (result hidden from chat)',
      'aria-label': 'Roll privately (result hidden from chat)',
      'aria-pressed': String(secret),
      onClick: () => ui.toggleSecretRoll?.(),
    }, h(WhisperIcon, {})),
    h('button', {
      key: 'save', type: 'button', class: `dbt${size}`, id: 'save-formula-btn',
      title: 'Save current formula as a macro', 'aria-label': 'Save dice formula as macro',
      onClick: () => ui.saveCurrentFormula?.(),
    }, h(StarIcon, {})),
    h('select', {
      key: 'macros', id: 'dice-macros-select', class: 'dice-bar__macros',
      'aria-label': 'Saved dice macros', title: 'Saved macros',
      value: '',
      onChange: (e) => { ui.rollMacro?.(e.target.value); e.target.value = ''; },
    }, [
      h('option', { key: '', value: '' }, macros.length ? 'Macros…' : 'No macros yet'),
      ...macros.map((f) => h('option', { key: f, value: f }, f)),
    ]),
  ];
}

/** Say / Describe / OOC, the one place speaking mode is chosen. */
export function ChatModePills({ size = ' dbt--sm' }) {
  const mode = chatModeSignal.value;
  return h('div', { class: 'dice-bar__chat-mode', role: 'radiogroup', 'aria-label': 'Speaking mode' }, [
    ...CHAT_MODES.map((m) => h('button', {
      key: m.id,
      type: 'button',
      class: `dbt${size}${mode === m.id ? ' dbt--active' : ''}`,
      role: 'radio',
      'aria-checked': String(mode === m.id),
      'data-chat-mode': m.id,
      title: m.title,
      // preventDefault on mousedown keeps focus in the textarea so the
      // pill doesn't unmount on blur before the click event fires
      // (showChipStack is gated by composerFocused).
      onMouseDown: (e) => { e.preventDefault(); },
      onClick: () => { chatModeSignal.value = m.id; },
    }, m.label)),
    h(HelpIcon, { key: 'help', term: 'msgtype', label: 'What the speaking modes mean' }),
    mode === 'ooc' && h(HelpIcon, { key: 'ooc-help', term: 'ooc', label: 'What out of character means' }),
  ]);
}
