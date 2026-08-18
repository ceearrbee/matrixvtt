/**
 * DiceBar.jsx - dice roll buttons, advantage/disadvantage, macros, chat input.
 *
 * Single condensed row, split into three clusters:
 *   - Quick-roll: d4 … d20, mod input, Roll button.
 *   - Extras (behind ▾): Adv, Dis, secret roll, save formula, macros.
 *   - Chat cluster: Say / Describe / OOC mode pills, tone pill (Say only),
 *     persona dropdown (filtered for non-GMs), input, Send.
 */

import { h } from 'preact';
import { useRef, useState, useEffect } from 'preact/hooks';
import {
  logVersionSignal, speakAsSignal, replyContextSignal, secretRollSignal,
  chatModeSignal, chatToneSignal, activeSceneSignal,
} from '../state/ui-signals.js';
import { tokensSignal, charactersSignal, initiativeSignal } from '../state/signals.js';
import { ChatTonePicker } from './ChatTonePicker.jsx';
import { QuickTray } from './QuickTray.jsx';
import { ComposerActionsPopover } from './ComposerActionsPopover.jsx';
import { useIsMobile } from './useIsMobile.js';
import { leaveScene } from './scene-mode.js';
import { showSceneStartModal } from './SceneStartModal.js';
import { openLongPostModal } from './LongPostModal.js';
import { SceneIcon, LongPostIcon, PersonIcon, GearIcon, WhisperIcon, StarIcon, PlayIcon } from './icons/index.jsx';
import { readDraft, writeDraft, autoGrow } from './chat-composer-helpers.js';

const DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];

const CHAT_MODES = [
  { id: 'say', label: 'Say', title: 'Speak as your character' },
  { id: 'describe', label: 'Describe', title: 'Narrate an action in the third person' },
  { id: 'ooc', label: 'OOC', title: 'Speak as yourself, out of character' },
];

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
  const chatRef = useRef(null);
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
  const rolls = ui.state.settings?.systemConfig?.rolls ?? {};
  const hasAdv = !!rolls.advantage;
  const hasDis = !!rolls.disadvantage;

  const roomId = ui.state.widgetManager?.roomId || null;
  const sendChat = () => {
    const input = chatRef.current;
    if (!input) return;
    const value = input.value;
    if (!value.trim()) return;
    ui.sendChatMessage?.(value);
    input.value = '';
    writeDraft(roomId, '');
    autoGrow(input);
  };
  // Enter sends. Shift+Enter inserts newline (default textarea behaviour).
  // Cmd/Ctrl+Enter also sends, matching common chat-UX expectations on
  // platforms where users habitually press the modifier.
  const onChatKey = (e) => {
    if (e.key !== 'Enter') return;
    if (e.shiftKey) return;
    if (e.isComposing) return; // IME composition; let it complete
    e.preventDefault();
    sendChat();
  };
  const onChatInput = (e) => {
    autoGrow(e.currentTarget);
    writeDraft(roomId, e.currentTarget.value);
  };

  // Restore the saved draft on mount (page reload mid-typing).
  useEffect(() => {
    const input = chatRef.current;
    if (!input || !roomId) return;
    const saved = readDraft(roomId);
    if (saved) {
      input.value = saved;
      autoGrow(input);
    }
  }, [roomId]);

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
    ...(diceStripOpen ? DICE : []).map(d => h('button', {
      key: d,
      class: `dbt${selected === d ? ' dbt--active' : ''}`,
      'data-dice': d,
      'aria-label': `Roll ${d}`,
      title: `Roll ${d}`,
      onClick: () => { setSelected(d); ui.rollDice(d); },
    }, d)),
    diceStripOpen && h('label', { for: 'dice-modifier', class: 'dice-bar__mod-label', title: 'Dice modifier' }, 'mod'),
    diceStripOpen && h('input', { type: 'number', id: 'dice-modifier', class: 'dice-bar__mod-input', value: 0, 'aria-label': 'Dice modifier', title: 'Dice modifier' }),
    diceStripOpen && h('button', { class: 'dbt', id: 'roll-dice', style: 'font-weight:500', 'aria-label': 'Roll selected die with modifier', title: 'Roll dice', onClick: () => ui.rollDice(selected) }, 'Roll'),
    diceStripOpen && h('button', {
      class: `dbt${extrasOpen ? ' dbt--active' : ''}`,
      'data-dice-more': true,
      'aria-label': extrasOpen ? 'Hide extra dice tools' : 'Show extra dice tools',
      'aria-expanded': String(extrasOpen),
      title: 'More dice tools',
      onClick: () => setExtrasOpen((v) => !v),
    }, extrasOpen ? '▴' : '▾'),
    diceStripOpen && extrasOpen && hasAdv && h('button', { class: 'dbt', id: 'adv-roll-btn', title: 'Roll with advantage', 'aria-label': 'Roll with advantage', onClick: () => ui.rollWithAdvantage() }, 'Adv'),
    diceStripOpen && extrasOpen && hasDis && h('button', { class: 'dbt', id: 'dis-roll-btn', title: 'Roll with disadvantage', 'aria-label': 'Roll with disadvantage', onClick: () => ui.rollWithDisadvantage() }, 'Dis'),
    diceStripOpen && extrasOpen && h('button', {
      class: `dbt${secretRollSignal.value ? ' dbt--active' : ''}`,
      id: 'secret-roll-btn',
      title: 'Roll privately (result hidden from chat)',
      'aria-label': 'Roll privately (result hidden from chat)',
      'aria-pressed': String(secretRollSignal.value),
      onClick: () => ui.toggleSecretRoll(),
    }, h(WhisperIcon, {})),
    diceStripOpen && extrasOpen && h('button', { class: 'dbt', id: 'save-formula-btn', title: 'Save current formula as a macro', 'aria-label': 'Save dice formula as macro', onClick: () => ui.saveCurrentFormula() }, h(StarIcon, {})),
    diceStripOpen && extrasOpen && h('select', {
      id: 'dice-macros-select',
      class: 'dice-bar__macros',
      'aria-label': 'Saved dice macros',
      title: 'Saved macros',
      style: 'max-width:100px',
      onChange: (e) => ui.rollMacro(e.target.value),
    }, h('option', { value: '' }, 'Macros…')),
    h(DiceResult, { html: ui._latestDiceResult || '' }),
    ui.widgetManager?.isAppClient && h(ChatCluster, {
      ui, isGM, chatRef, onChatKey, onChatInput, sendChat,
      extras: mobileExtras,
      isMobile,
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

function ChatModePills() {
  const mode = chatModeSignal.value;
  return h('div', { class: 'dice-bar__chat-mode', role: 'radiogroup', 'aria-label': 'Speaking mode' },
    CHAT_MODES.map((m) => h('button', {
      key: m.id,
      type: 'button',
      class: `dbt dbt--sm${mode === m.id ? ' dbt--active' : ''}`,
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
  );
}

function TonePill() {
  const [open, setOpen] = useState(false);
  const tone = chatToneSignal.value;
  const label = tone?.name ?? 'Tone';
  const swatchStyle = tone?.color ? `background:${tone.color}` : '';
  return h('div', { class: 'dice-bar__tone-anchor' }, [
    h('button', {
      type: 'button',
      class: `dbt dbt--sm${tone ? ' dbt--active' : ''}`,
      'data-tone-pill': true,
      'aria-haspopup': 'dialog',
      'aria-expanded': String(open),
      title: tone ? `Tone: ${tone.name} (click to change)` : 'Pick a speaking tone',
      onClick: () => setOpen((v) => !v),
    }, [
      tone?.color ? h('span', { class: 'tone-swatch', style: swatchStyle, 'aria-hidden': 'true' }) : null,
      label,
    ]),
    open && h(ChatTonePicker, { onClose: () => setOpen(false) }),
  ]);
}

function _personaOptions(ui, isGM) {
  charactersSignal.value;
  const myUserId = ui.widgetManager?.userId;
  const tokens = Array.from(ui.state.tokens.entries());
  if (isGM) return tokens;
  return tokens.filter(([, t]) => {
    if (t.owner_user_id && t.owner_user_id === myUserId) return true;
    const sheet = ui.state.characters.get(t.sheet_id);
    if (!sheet) return false;
    return sheet.claimed_by_user_id === myUserId || sheet.player_user_id === myUserId;
  });
}

function ChatCluster({ ui, isGM, chatRef, onChatKey, onChatInput, sendChat, extras = null, isMobile = false }) {
  // Subscribe so the persona dropdown, mode pills, tone pill, and reply
  // chip refresh reactively.
  tokensSignal.value;
  chatModeSignal.value;
  const replyCtx = replyContextSignal.value;
  const scene = activeSceneSignal.value;
  const personas = _personaOptions(ui, isGM);
  const mode = chatModeSignal.value;
  const roomId = ui.state?.widgetManager?.roomId || null;

  const [composerFocused, setComposerFocused] = useState(false);
  // Composer cohesion: active-scene no longer force-reveals the chip
  // stack. During long scene threads the composer stays quiet by
  // default - pills surface only on focus, on reply context, or when
  // the user has actually picked a non-default mode. The scene banner
  // still renders independently so the user can see / leave the
  // scene at a glance.
  const showChipStack = composerFocused || !!replyCtx || mode !== 'say';
  // Persona chip - a compact chip shows the current speak-as identity;
  // clicking expands the picker, which auto-collapses on a new choice.
  const [personaPickerOpen, setPersonaPickerOpen] = useState(false);
  const currentPersona = personas.find(([id]) => id === speakAsSignal.value);
  const personaLabel = currentPersona?.[1]?.name ?? 'You';

  return h('div', { class: 'dice-bar__chat-cluster' }, [
    h('div', { class: 'dice-bar__sep' }),
    scene && h('div', { class: 'scene-banner', role: 'status', 'aria-live': 'polite' }, [
      h('span', { class: 'scene-banner__icon', 'aria-hidden': 'true' }, '🎬'),
      h('span', { class: 'scene-banner__title' }, `Posting in: ${scene.title}`),
      h('button', {
        type: 'button',
        class: 'scene-banner__leave',
        title: 'Leave the scene; subsequent chat goes to the main timeline',
        'aria-label': 'Leave scene',
        onClick: () => leaveScene(ui),
      }, '×'),
    ]),
    replyCtx && h('div', { class: 'reply-context-chip' }, [
      h('span', null, `Replying to ${replyCtx.rootSender}: ${replyCtx.rootPreview}…`),
      h('button', {
        type: 'button',
        onClick: () => { replyContextSignal.value = null; },
        'aria-label': 'Clear reply context',
      }, '×'),
    ]),
    showChipStack && h(ChatModePills, {}),
    showChipStack && mode === 'say' && h(TonePill, {}),
    // Persona widget. The chip is the always-visible representation
    // of the current speak-as identity; the underlying <select> stays
    // in the DOM (gated by `personaPickerOpen` via a visibility
    // class so existing tests can find #speak-as-select) but is
    // visually hidden until the chip is clicked. OOC drops both
    // entirely - the player is always themselves in OOC.
    mode !== 'ooc' && personas.length > 0 && h('button', {
      type: 'button',
      class: `dbt dbt--sm persona-chip${currentPersona ? ' dbt--active' : ''}`,
      'data-persona-chip': true,
      'aria-expanded': String(personaPickerOpen),
      'aria-haspopup': 'listbox',
      title: currentPersona
        ? `Speaking as ${personaLabel} (click to change)`
        : 'Click to speak as a character',
      onClick: () => setPersonaPickerOpen((v) => !v),
    }, [
      h('span', { class: 'persona-chip__icon', 'aria-hidden': 'true' }, h(PersonIcon, {})),
      h('span', { class: 'persona-chip__label' }, personaLabel),
    ]),
    mode !== 'ooc' && personas.length > 0 && h('select', {
      id: 'speak-as-select',
      class: `dice-bar__speak-as${personaPickerOpen ? '' : ' dice-bar__speak-as--collapsed'}`,
      'aria-label': 'Speak as character',
      title: 'Speak as…',
      value: speakAsSignal.value,
      onChange: (e) => {
        ui.setSpeakAs?.(e.target.value);
        // Auto-collapse the picker after a choice - the chip will
        // reflect the new persona name.
        setPersonaPickerOpen(false);
      },
    }, [
      h('option', { value: '' }, 'Speak as yourself'),
      ...personas.map(([id, t]) =>
        h('option', { value: id, key: id }, t.name)),
    ]),
    showChipStack && !scene && h('button', {
      type: 'button',
      class: 'dbt dbt--sm scene-start-btn',
      title: 'Start a scene-thread: every chat sent while in-scene threads under it',
      'aria-label': 'Start a scene',
      onClick: () => showSceneStartModal(ui),
    }, [h(SceneIcon, {}), ' Scene']),
    h('label', { for: 'chat-input', class: 'sr-only' }, 'Chat message'),
    h('textarea', {
      id: 'chat-input',
      ref: chatRef,
      class: 'dice-bar__chat-input chat-input--multiline',
      rows: 1,
      placeholder: isMobile
        ? (mode === 'describe' ? 'Describe…' : mode === 'ooc' ? 'OOC…' : 'Message…')
        : mode === 'describe'
          ? 'Describe… (Shift+Enter for newline · markdown supported)'
          : mode === 'ooc'
            ? 'Out-of-character message… (Shift+Enter for newline · markdown supported)'
            : 'Send message… (Shift+Enter for newline · markdown supported · /w @user to whisper)',
      autocomplete: 'off',
      'aria-label': 'Chat message input',
      title: 'Chat message input. Enter to send, Shift+Enter for newline.',
      onKeyDown: onChatKey,
      onInput: onChatInput,
      onFocus: () => setComposerFocused(true),
      // Defer blur a tick so any in-flight click on a chip pill (Say /
      // Describe / OOC / Tone / persona) lands before showChipStack
      // re-evaluates to false and unmounts those buttons.
      onBlur: () => setTimeout(() => setComposerFocused(false), 0),
    }),
    h('button', {
      type: 'button',
      class: 'dbt dbt--sm long-post-btn',
      'aria-label': 'Open full editor for a long post',
      title: 'Open the full editor (WYSIWYG, multi-paragraph)',
      onClick: () => openLongPostModal({
        ui,
        syncInline: () => {
          const input = chatRef.current;
          if (!input) return;
          input.value = readDraft(roomId);
          autoGrow(input);
        },
      }),
    }, h(LongPostIcon, {})),
    // Mobile-only nodes spliced in by DiceBar (actions popover trigger;
    // next-turn when combat is active). Null/empty on desktop.
    ...(Array.isArray(extras) ? extras : extras ? [extras] : []),
    h('button', { class: 'dbt', id: 'chat-send', 'aria-label': 'Send chat message', title: 'Send chat message', onClick: sendChat }, 'Send'),
  ]);
}
