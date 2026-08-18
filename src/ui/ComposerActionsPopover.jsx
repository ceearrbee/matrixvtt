/**
 * ComposerActionsPopover - mobile-only floating popover anchored above
 * the composer. Collapses the QuickTray + inline dice strip behind a
 * single "Actions" button, matching the rpglog pattern.
 *
 * Wraps the SAME handlers the inline strip uses (`ui.rollDice`,
 * `ui.rollWithAdvantage`, `ui.toggleSecretRoll`, `ui.rollMacro`,
 * `ui.saveCurrentFormula`, `ui.nextTurn`) and the same
 * signals (`secretRollSignal`, `chatModeSignal`, `initiativeSignal`) -
 * no new business logic, just composition.
 */
import { h } from 'preact';
import { SceneIcon, WhisperIcon, StarIcon } from './icons/index.jsx';
import { useEffect, useRef } from 'preact/hooks';
import { secretRollSignal, chatModeSignal, activeSceneSignal } from '../state/ui-signals.js';

import { showSceneStartModal } from './SceneStartModal.js';

const DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];

const CHAT_MODES = [
  { id: 'say', label: 'Say' },
  { id: 'describe', label: 'Describe' },
  { id: 'ooc', label: 'OOC' },
];

export function ComposerActionsPopover({ ui, selected, onSelectedChange, onClose }) {
  const rootRef = useRef(null);
  const mode = chatModeSignal.value;
  const secret = secretRollSignal.value;
  const scene = activeSceneSignal.value;
  const rolls = ui.state.settings?.systemConfig?.rolls ?? {};
  const hasAdv = !!rolls.advantage;
  const hasDis = !!rolls.disadvantage;

  // Outside-click + Escape close. Matches src/ui/ChatTonePicker.jsx - the
  // same pattern the header popovers use.
  useEffect(() => {
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose?.();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const roll = (die) => { onSelectedChange?.(die); ui.rollDice?.(die); };
  const rollWithMod = () => ui.rollDice?.(selected);
  const setMode = (next) => { chatModeSignal.value = next; };

  return h('div', {
    ref: rootRef,
    class: 'composer-popover',
    role: 'dialog',
    'aria-label': 'Composer actions',
  }, [
    h('div', { class: 'composer-popover__section' }, [
      h('div', { class: 'composer-popover__label' }, 'Quick dice'),
      h('div', { class: 'composer-popover__dice-grid' },
        DICE.map((d) => h('button', {
          key: d, type: 'button',
          class: `dbt dbt--sm${selected === d ? ' dbt--active' : ''}`,
          'data-dice': d,
          'aria-label': `Roll ${d}`,
          onClick: () => roll(d),
        }, d))),
    ]),
    h('div', { class: 'composer-popover__section' }, [
      h('div', { class: 'composer-popover__row' }, [
        h('label', { for: 'dice-modifier', class: 'dice-bar__mod-label' }, 'mod'),
        h('input', {
          type: 'number', id: 'dice-modifier',
          class: 'dice-bar__mod-input',
          defaultValue: 0,
          'aria-label': 'Dice modifier',
        }),
        h('button', {
          type: 'button', class: 'dbt dbt--sm composer-popover__roll',
          id: 'roll-dice',
          'aria-label': 'Roll selected die with modifier',
          onClick: rollWithMod,
        }, 'Roll'),
      ]),
    ]),
    (hasAdv || hasDis) && h('div', { class: 'composer-popover__section' }, [
      h('div', { class: 'composer-popover__label' }, 'Advantage'),
      h('div', { class: 'composer-popover__row' }, [
        hasAdv && h('button', {
          type: 'button', class: 'dbt dbt--sm', id: 'adv-roll-btn',
          'aria-label': 'Roll with advantage',
          onClick: () => ui.rollWithAdvantage?.(),
        }, 'Adv'),
        hasDis && h('button', {
          type: 'button', class: 'dbt dbt--sm', id: 'dis-roll-btn',
          'aria-label': 'Roll with disadvantage',
          onClick: () => ui.rollWithDisadvantage?.(),
        }, 'Dis'),
        h('button', {
          type: 'button',
          class: `dbt dbt--sm${secret ? ' dbt--active' : ''}`,
          id: 'secret-roll-btn',
          'aria-label': 'Roll privately',
          'aria-pressed': String(secret),
          onClick: () => ui.toggleSecretRoll?.(),
        }, h(WhisperIcon, {})),
        h('button', {
          type: 'button', class: 'dbt dbt--sm', id: 'save-formula-btn',
          'aria-label': 'Save dice formula as macro',
          onClick: () => ui.saveCurrentFormula?.(),
        }, h(StarIcon, {})),
      ]),
    ]),
    h('div', { class: 'composer-popover__section' }, [
      h('div', { class: 'composer-popover__label' }, 'Macros'),
      h('div', { class: 'composer-popover__row' }, [
        h('select', {
          id: 'dice-macros-select',
          class: 'dice-bar__macros',
          'aria-label': 'Saved dice macros',
          onChange: (e) => ui.rollMacro?.(e.target.value),
        }, h('option', { value: '' }, 'Macros…')),
      ]),
    ]),
    h('div', { class: 'composer-popover__section' }, [
      h('div', { class: 'composer-popover__label' }, 'Speaking mode'),
      h('div', { class: 'composer-popover__row' }, CHAT_MODES.map((m) => h('button', {
        key: m.id,
        type: 'button',
        class: `dbt dbt--sm${mode === m.id ? ' dbt--active' : ''}`,
        'data-chat-mode': m.id,
        'aria-pressed': String(mode === m.id),
        'aria-label': m.label,
        onClick: () => setMode(m.id),
      }, m.label))),
    ]),
    !scene && h('div', { class: 'composer-popover__section' }, [
      h('button', {
        type: 'button',
        class: 'dbt dbt--sm composer-popover__roll',
        'aria-label': 'Start a scene',
        onClick: () => { onClose?.(); showSceneStartModal(ui); },
      }, [h(SceneIcon, {}), ' Start a scene']),
    ]),
  ]);
}
