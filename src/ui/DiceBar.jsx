/**
 * DiceBar.jsx - the composer row: dice quick-roll, the latest result,
 * and the chat composer mounted beside them.
 *
 *   - Quick-roll (behind `Dice ▾`): d4 … d20, mod input, Roll button.
 *   - Extras (behind a second ▾): Adv, Dis, secret roll, save formula,
 *     macros.
 *   - The chat cluster itself lives in `composer/ChatCluster.jsx`.
 */

import { h } from 'preact';
import { useRef, useState, useEffect } from 'preact/hooks';
import { logVersionSignal } from '../state/ui-signals.js';
import { initiativeSignal } from '../state/signals.js';
import { QuickTray } from './QuickTray.jsx';
import { ComposerActionsPopover } from './ComposerActionsPopover.jsx';
import { useIsMobile } from './useIsMobile.js';
import { GearIcon, PlayIcon } from './icons/index.jsx';
import { ChatCluster } from './composer/ChatCluster.jsx';
import { DiceButtons, ModifierRow, ExtraRolls } from './composer/dice-controls.jsx';

/**
 * Dice-result sink. `ui._latestDiceResult` is built by
 * `updateDiceResult` in state-updater.js - expression, per-die results,
 * total, and label all route through `esc()`. Lock-in:
 * src/__tests__/diceResultEscaping.test.js.
 */
function DiceResult({ html }) {
  return h('div', {
    id: 'dice-result',
    class: 'dice-bar__result',
    'aria-live': 'polite',
    'aria-atomic': 'true',
    title: 'Latest roll result',
    dangerouslySetInnerHTML: { __html: html },
  });
}

export function DiceBar({ ui }) {
  logVersionSignal.value;
  const diceBarRef = useRef(null);
  const [selected, setSelected] = useState('d20');
  const [extrasOpen, setExtrasOpen] = useState(false);
  // Composer cohesion pass: the inline dice quick-roll strip (d4..d20
  // + mod + Roll + ▾ extras) is collapsed by default behind a single
  // `Dice ▾` chip so the always-visible composer row reads as one
  // band instead of two. The toggle is session-local - power users
  // who want the strip always visible click once per session.
  const [diceStripOpen, setDiceStripOpen] = useState(false);
  // Mobile-only: the inline strip + QuickTray collapse behind a single
  // gear button that opens this popover anchored above the composer
  // (rpglog pattern). Desktop ignores `actionsOpen`.
  const isMobile = useIsMobile();
  const [actionsOpen, setActionsOpen] = useState(false);
  const combatActive = !!initiativeSignal.value?.active;
  // Track the live composer height so the floating popover sits just above
  // the input row regardless of whether the textarea grew to 2/3 lines.
  useEffect(() => {
    if (!isMobile) return undefined;
    const el = diceBarRef.current;
    if (!el || typeof ResizeObserver !== 'function') return undefined;
    const apply = () => el.style.setProperty('--composer-h', `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile]);
  const isGM = ui.state.isGM();

  // Mobile composer extras spliced into the chat cluster (single row): gear
  // toggles the floating ComposerActionsPopover (dice + adv/dis + macros +
  // secret + IC/OOC), and next-turn surfaces inline only when combat is
  // active (frequent enough to skip a popover tap).
  const mobileExtras = isMobile ? [
    combatActive && h('button', {
      key: 'next-turn',
      type: 'button',
      class: 'dbt dbt--sm composer-next-turn',
      'aria-label': 'Next turn',
      title: 'Next turn',
      onClick: () => ui.nextTurn?.(),
    }, h(PlayIcon, {})),
    h('button', {
      key: 'actions-toggle',
      type: 'button',
      class: `dbt dbt--sm composer-action-toggle${actionsOpen ? ' dbt--active' : ''}`,
      'aria-label': actionsOpen ? 'Close actions' : 'Open actions',
      'aria-expanded': String(actionsOpen),
      title: 'Dice, macros, mode, adv/dis',
      onClick: () => setActionsOpen((v) => !v),
    }, h(GearIcon, {})),
  ] : null;

  return h('div', { class: 'dice-bar', ref: diceBarRef, role: 'toolbar', 'aria-label': 'Dice and chat' }, [
    !isMobile && h(QuickTray, { ui, key: 'quick-tray' }),
    !isMobile && h('button', {
      key: 'dice-toggle',
      class: `dbt dbt--sm${diceStripOpen ? ' dbt--active' : ''}`,
      'data-dice-strip-toggle': true,
      'aria-expanded': String(diceStripOpen),
      'aria-label': diceStripOpen ? 'Hide dice toolbar' : 'Show dice toolbar',
      title: diceStripOpen ? 'Hide dice toolbar' : 'Show dice toolbar',
      onClick: () => setDiceStripOpen((v) => !v),
    }, diceStripOpen ? 'Dice ▴' : 'Dice ▾'),
    ...(diceStripOpen ? DiceButtons({ ui, selected, onSelect: setSelected }) : []),
    ...(diceStripOpen ? ModifierRow({ ui, selected }) : []),
    diceStripOpen && h('button', {
      class: `dbt${extrasOpen ? ' dbt--active' : ''}`,
      'data-dice-more': true,
      'aria-label': extrasOpen ? 'Hide extra dice tools' : 'Show extra dice tools',
      'aria-expanded': String(extrasOpen),
      title: 'More dice tools',
      onClick: () => setExtrasOpen((v) => !v),
    }, extrasOpen ? '▴' : '▾'),
    ...(diceStripOpen && extrasOpen ? ExtraRolls({ ui }) : []),
    h(DiceResult, { html: ui._latestDiceResult || '' }),
    ui.widgetManager?.isAppClient && h(ChatCluster, {
      ui, isGM, extras: mobileExtras, isMobile,
    }),
    // Floating popover anchored above the composer (mobile only). Closed
    // on outside click + Escape from inside the popover component.
    isMobile && actionsOpen && h(ComposerActionsPopover, {
      ui,
      selected,
      onSelectedChange: setSelected,
      onClose: () => setActionsOpen(false),
    }),
  ]);
}
