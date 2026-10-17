/**
 * composer/ChatCluster.jsx - the chat half of the composer row: scene
 * banner, reply chip, speaking-mode pills, tone, persona, the input
 * itself and Send.
 *
 * It lived in DiceBar.jsx because both sit in one row on screen. They
 * are not one feature: the dice strip rolls, this speaks.
 */

import { h } from 'preact';
import { useRef, useState, useEffect } from 'preact/hooks';
import { HelpIcon } from '../HelpIcon.jsx';
import {
  speakAsSignal, replyContextSignal, chatModeSignal, chatToneSignal, activeSceneSignal,
} from '../../state/ui-signals.js';
import { tokensSignal, charactersSignal } from '../../state/signals.js';
import { ChatTonePicker } from '../ChatTonePicker.jsx';
import { leaveScene } from '../scene-mode.js';
import { showSceneStartModal } from '../SceneStartModal.js';
import { openLongPostModal } from '../LongPostModal.js';
import { SceneIcon, LongPostIcon, PersonIcon } from '../icons/index.jsx';
import { readDraft, writeDraft, autoGrow } from '../chat-composer-helpers.js';
import { ChatModePills } from './dice-controls.jsx';
import { normalizeEmDashes } from '../../utils/format.js';


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

export function ChatCluster({ ui, isGM, extras = null, isMobile = false }) {
  const chatRef = useRef(null);
  // Subscribe so the persona dropdown, mode pills, tone pill, and reply
  // chip refresh reactively.
  tokensSignal.value;
  chatModeSignal.value;
  const replyCtx = replyContextSignal.value;
  const scene = activeSceneSignal.value;
  const personas = _personaOptions(ui, isGM);
  const mode = chatModeSignal.value;

  const roomId = ui.state?.widgetManager?.roomId || null;

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
  const hasMeta = !!(scene || replyCtx || showChipStack);

  return h('div', { class: 'dice-bar__chat-cluster' }, [
    hasMeta && h('div', { class: 'dice-bar__composer-meta' }, [
      scene && h('div', { class: 'scene-banner', role: 'status', 'aria-live': 'polite' }, [
        h('span', { class: 'scene-banner__icon', 'aria-hidden': 'true' }, '🎬'),
        h('span', { class: 'scene-banner__title' }, `Posting in: ${normalizeEmDashes(scene.title)}`),
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
          title: 'Clear reply context',
        }, '×'),
      ]),
      showChipStack && h(ChatModePills, {}),
      showChipStack && mode === 'say' && h(TonePill, {}),
      showChipStack && !scene && h('button', {
        type: 'button',
        class: 'dbt dbt--sm scene-start-btn',
        title: 'Start a scene-thread: every chat sent while in-scene threads under it',
        'aria-label': 'Start a scene',
        onClick: () => showSceneStartModal(ui),
      }, [h(SceneIcon, {}), ' Scene']),
    ]),
    h('div', { class: 'dice-bar__input-row' }, [
      h('div', { class: 'dice-bar__sep' }),
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
      mode !== 'ooc' && personas.length > 0
        && h(HelpIcon, { key: 'persona-help', term: 'persona', label: 'What speaking as someone else does' }),
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
              : 'Send message… (Ctrl+K to search or run a command · /w @user to whisper)',
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
    ]),
  ]);
}
