/**
 * ComposerActionsPopover - mobile-only floating popover anchored above
 * the composer. Collapses the QuickTray + inline dice strip behind a
 * single "Actions" button, matching the rpglog pattern.
 *
 * Renders the SAME controls the inline strip does, from
 * `composer/dice-controls.jsx`; only the layout differs (stacked
 * sections here, one flex row there). No business logic of its own.
 */
import { h } from 'preact';
import { SceneIcon } from './icons/index.jsx';
import { useEffect, useRef } from 'preact/hooks';
import { activeSceneSignal } from '../state/ui-signals.js';

import { showSceneStartModal } from './SceneStartModal.js';
import {
  DiceButtons, ModifierRow, ExtraRolls, ChatModePills,
} from './composer/dice-controls.jsx';

export function ComposerActionsPopover({ ui, selected, onSelectedChange, onClose }) {
  const rootRef = useRef(null);
  const scene = activeSceneSignal.value;

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

  return h('div', {
    ref: rootRef,
    class: 'composer-popover',
    role: 'dialog',
    'aria-label': 'Composer actions',
  }, [
    h('div', { class: 'composer-popover__section' }, [
      h('div', { class: 'composer-popover__label' }, 'Quick dice'),
      h('div', { class: 'composer-popover__dice-grid' },
        DiceButtons({ ui, selected, onSelect: onSelectedChange, size: ' dbt--sm' })),
    ]),
    h('div', { class: 'composer-popover__section' },
      h('div', { class: 'composer-popover__row' }, ModifierRow({ ui, selected, size: ' dbt--sm composer-popover__roll' }))),
    h('div', { class: 'composer-popover__section' }, [
      h('div', { class: 'composer-popover__label' }, 'Rolls and macros'),
      h('div', { class: 'composer-popover__row' }, ExtraRolls({ ui, size: ' dbt--sm' })),
    ]),
    h('div', { class: 'composer-popover__section' }, [
      h('div', { class: 'composer-popover__label' }, 'Speaking mode'),
      h('div', { class: 'composer-popover__row' }, h(ChatModePills, {})),
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
