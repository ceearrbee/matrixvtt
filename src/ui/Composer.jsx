/**
 * DEPRECATED - not mounted. The legacy DiceBar.jsx still owns the
 * chat cluster (mode pills, tone, persona, scene, reply, textarea,
 * send) inside the existing App.jsx footer. Kept for reference /
 * rollback.
 *
 * Composer.jsx - chat cluster for the new chat-shell.
 *
 * Extracted from DiceBar's ChatCluster. Owns:
 *   - scene banner + reply chip
 *   - mode pills (Say / Describe / OOC)
 *   - tone pill (Say only)
 *   - persona select (filtered for non-GMs)
 *   - +Scene start button
 *   - textarea (with auto-grow + per-room draft restore)
 *   - long-post modal button
 *   - send button
 *
 * Behavior is identical to DiceBar's chat cluster - same signals,
 * same helpers (`chat-composer-helpers.js`). DiceBar still mounts its
 * own copy; this is intentional dual-track until the new shell
 * retires the old one.
 */

import { h } from 'preact';
import { useRef, useState, useEffect } from 'preact/hooks';
import {
  speakAsSignal, replyContextSignal,
  chatModeSignal, chatToneSignal, activeSceneSignal,
} from '../state/ui-signals.js';
import { tokensSignal, charactersSignal } from '../state/signals.js';
import { ChatTonePicker } from './ChatTonePicker.jsx';
import { leaveScene } from './scene-mode.js';
import { showSceneStartModal } from './SceneStartModal.js';
import { openLongPostModal } from './LongPostModal.js';
import { SceneIcon, LongPostIcon } from './icons/index.jsx';
import { readDraft, writeDraft, autoGrow } from './chat-composer-helpers.js';

const CHAT_MODES = [
  { id: 'say', label: 'Say', title: 'Speak in-character' },
  { id: 'describe', label: 'Describe', title: 'Describe a third-person action' },
  { id: 'ooc', label: 'OOC', title: 'Speak out-of-character' },
];

function ChatModePills() {
  const mode = chatModeSignal.value;
  return h('div', { class: 'composer__chat-mode', role: 'radiogroup', 'aria-label': 'Speaking mode' },
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
  return h('div', { class: 'composer__tone-anchor' }, [
    h('button', {
      type: 'button',
      class: `dbt dbt--sm${tone ? ' dbt--active' : ''}`,
      'data-tone-pill': true,
      'aria-haspopup': 'dialog',
      'aria-expanded': String(open),
      title: tone ? `Tone: ${tone.name} - click to change` : 'Pick a speaking tone',
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

export function Composer({ ui }) {
  const chatRef = useRef(null);
  const roomId = ui.state.widgetManager?.roomId || null;
  const isGM = ui.state.isGM();

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

  const onChatKey = (e) => {
    if (e.key !== 'Enter') return;
    if (e.shiftKey) return;
    if (e.isComposing) return;
    e.preventDefault();
    sendChat();
  };

  const onChatInput = (e) => {
    autoGrow(e.currentTarget);
    writeDraft(roomId, e.currentTarget.value);
  };

  useEffect(() => {
    const input = chatRef.current;
    if (!input || !roomId) return;
    const saved = readDraft(roomId);
    if (saved) {
      input.value = saved;
      autoGrow(input);
    }
  }, [roomId]);

  // Subscribe so the persona dropdown, mode pills, tone pill, and reply
  // chip refresh reactively.
  tokensSignal.value;
  const replyCtx = replyContextSignal.value;
  const scene = activeSceneSignal.value;
  const personas = _personaOptions(ui, isGM);
  const mode = chatModeSignal.value;

  const [composerFocused, setComposerFocused] = useState(false);
  const showChipStack = composerFocused || !!scene || !!replyCtx || mode !== 'say';

  return h('div', { class: 'composer', 'data-composer': '' }, [
    scene && h('div', { class: 'scene-banner', role: 'status', 'aria-live': 'polite', key: 'sb' }, [
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
    replyCtx && h('div', { class: 'reply-context-chip', key: 'rc' }, [
      h('span', null, `Replying to ${replyCtx.rootSender}: ${replyCtx.rootPreview}…`),
      h('button', {
        type: 'button',
        onClick: () => { replyContextSignal.value = null; },
        'aria-label': 'Clear reply context',
      }, '×'),
    ]),
    showChipStack && h(ChatModePills, { key: 'mp' }),
    showChipStack && mode === 'say' && h(TonePill, { key: 'tp' }),
    mode !== 'ooc' && personas.length > 0 && h('select', {
      id: 'speak-as-select',
      class: 'composer__speak-as',
      'aria-label': 'Speak as character',
      title: 'Speak as…',
      value: speakAsSignal.value,
      key: 'sa',
      onChange: (e) => ui.setSpeakAs?.(e.target.value),
    }, [
      h('option', { value: '' }, 'Speak as yourself'),
      ...personas.map(([id, t]) =>
        h('option', { value: id, key: id }, t.name)),
    ]),
    showChipStack && !scene && h('button', {
      type: 'button',
      class: 'dbt dbt--sm scene-start-btn',
      title: 'Start a scene-thread - every chat sent while in-scene threads under it',
      'aria-label': 'Start a scene',
      key: 'ss',
      onClick: () => showSceneStartModal(ui),
    }, [h(SceneIcon, {}), ' Scene']),
    h('label', { for: 'chat-input', class: 'sr-only', key: 'lbl' }, 'Chat message'),
    h('textarea', {
      id: 'chat-input',
      ref: chatRef,
      class: 'composer__input chat-input--multiline',
      rows: 1,
      key: 'ta',
      placeholder: mode === 'describe'
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
      onBlur: () => setTimeout(() => setComposerFocused(false), 0),
    }),
    h('button', {
      type: 'button',
      class: 'dbt dbt--sm long-post-btn',
      'aria-label': 'Open full editor for a long post',
      title: 'Open the full editor (WYSIWYG, multi-paragraph)',
      key: 'lp',
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
    h('button', {
      type: 'button',
      class: 'dbt',
      id: 'chat-send',
      'data-composer-send': '',
      'aria-label': 'Send chat message',
      title: 'Send chat message',
      key: 'sn',
      onClick: sendChat,
    }, 'Send'),
  ]);
}
