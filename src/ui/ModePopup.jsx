/**
 * ModePopup.jsx - chat-shell Mode picker.
 *
 * Mirrors rpglog's Mode popup (game.php:401-444). Three sections:
 *
 *   - Mode radios - Say / Describe / OOC, mutates chatModeSignal.
 *   - Speak as NPC - input + Say / Does buttons that insert /as or
 *     /asd <Name>  prefix into the chat-input textarea.
 *   - Whisper to - input + Whisper button that inserts /w <user>
 *     prefix into the chat-input textarea.
 *
 * Discoverability hint: each helper row includes the slash form so
 * users learn the keyboard-only path by repeated exposure. Parser
 * lives in src/ui/slash-commands.js; this popup is the UI mirror
 * that surfaces the same grammar in a clickable form.
 *
 * The compose-helper rows reach into the DOM by id (`chat-input`)
 * because that's the stable contract Composer.jsx exposes - the
 * popup avoids threading a ref through signals just for this side
 * effect. Empty NPC / whisper names are no-ops so a stray click
 * doesn't clobber an in-progress message.
 */

import { h } from 'preact';
import { useRef } from 'preact/hooks';
import { chatModeSignal } from '../state/ui-signals.js';

const MODES = [
  { id: 'say',      label: 'Say' },
  { id: 'describe', label: 'Describe' },
  { id: 'ooc',      label: 'OOC' },
];

function _prepend(prefix) {
  const ta = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('chat-input'));
  if (!ta) return;
  ta.value = prefix + (ta.value || '');
  ta.focus();
  // Drop the caret at the end of the inserted prefix so the user
  // immediately types into the body slot.
  try { ta.setSelectionRange(prefix.length, prefix.length); }
  catch { /* unsupported element type; ignore */ }
}

function _quoteIfMultiword(name) {
  return /\s/.test(name) ? `"${name}"` : name;
}

export function ModePopup() {
  const npcNameRef = useRef(null);
  const whisperNameRef = useRef(null);
  const mode = chatModeSignal.value;

  const setMode = (id) => () => { chatModeSignal.value = id; };

  const insertAs = (cmd) => () => {
    const raw = (npcNameRef.current?.value || '').trim();
    if (!raw) return;
    _prepend(`/${cmd} ${_quoteIfMultiword(raw)} `);
  };

  const insertWhisper = () => {
    const raw = (whisperNameRef.current?.value || '').trim();
    if (!raw) return;
    _prepend(`/w ${raw} `);
  };

  return h('div', { class: 'mode-popup', 'data-mode-popup': '' }, [
    h('div', {
      class: 'mode-popup__radios',
      role: 'radiogroup',
      'aria-label': 'Speaking mode',
      key: 'r',
    }, MODES.map((m) => h('button', {
      key: m.id,
      type: 'button',
      role: 'radio',
      class: `mode-popup__radio${mode === m.id ? ' mode-popup__radio--active' : ''}`,
      'data-mode-radio': m.id,
      'aria-checked': String(mode === m.id),
      onClick: setMode(m.id),
    }, m.label))),

    h('section', { class: 'mode-popup__section', key: 'npc' }, [
      h('h3', { class: 'mode-popup__title', key: 't' }, 'Speak as NPC'),
      h('div', { class: 'mode-popup__row', key: 'r' }, [
        h('input', {
          ref: npcNameRef,
          type: 'text',
          class: 'mode-popup__input',
          placeholder: 'NPC name',
          'aria-label': 'NPC name',
          'data-mode-npc-name': '',
          key: 'i',
        }),
        h('button', {
          type: 'button', class: 'mode-popup__btn',
          'data-mode-npc-say': '',
          title: 'Insert /as Name prefix',
          'aria-label': 'Insert /as Name prefix',
          onClick: insertAs('as'),
          key: 'say',
        }, 'Say'),
        h('button', {
          type: 'button', class: 'mode-popup__btn',
          'data-mode-npc-does': '',
          title: 'Insert /asd Name prefix',
          'aria-label': 'Insert /asd Name prefix',
          onClick: insertAs('asd'),
          key: 'does',
        }, 'Does'),
      ]),
      h('p', { class: 'mode-popup__hint', key: 'h' }, [
        'Tip: ',
        h('code', null, '/as Bartender Welcome.'),
        ' in chat works the same.',
      ]),
    ]),

    h('section', { class: 'mode-popup__section', key: 'wh' }, [
      h('h3', { class: 'mode-popup__title', key: 't' }, 'Whisper to'),
      h('div', { class: 'mode-popup__row', key: 'r' }, [
        h('input', {
          ref: whisperNameRef,
          type: 'text',
          class: 'mode-popup__input',
          placeholder: '@user',
          'aria-label': 'Whisper target',
          'data-mode-whisper-name': '',
          key: 'i',
        }),
        h('button', {
          type: 'button', class: 'mode-popup__btn',
          'data-mode-whisper-send': '',
          title: 'Insert /w @user prefix',
          'aria-label': 'Insert /w @user prefix',
          onClick: insertWhisper,
          key: 's',
        }, 'Whisper'),
      ]),
      h('p', { class: 'mode-popup__hint', key: 'h' }, [
        'Tip: ',
        h('code', null, '/w @sarah hush'),
        ' in chat works the same.',
      ]),
    ]),
  ]);
}
