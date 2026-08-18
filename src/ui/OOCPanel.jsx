/**
 * OOCPanel.jsx - out-of-character side channel.
 *
 * rpglog inspiration: a dedicated popup that surfaces every OOC
 * message in one place, separate from the main IC log, with its own
 * quick-send box. Matrix-side, OOC messages are `msgtype: m.notice`
 * (see src/ui/chat-send.js:63). Local activity log entries get tagged
 * with the same msgtype so this filter lights up correctly on send.
 *
 * The quick-send temporarily flips `chatModeSignal` to 'ooc' so the
 * existing send pipeline routes through the OOC code path, then
 * restores the previous mode - the popup is intentionally a side
 * channel, not a mode switch.
 */

import { h } from 'preact';
import { useRef } from 'preact/hooks';
import { chatModeSignal, logVersionSignal } from '../state/ui-signals.js';
import { HelpIcon } from './HelpIcon.jsx';

function ooCEntries(activityLog) {
  if (!Array.isArray(activityLog)) return [];
  return activityLog.filter((e) => e?.msgtype === 'm.notice');
}

/**
 * @param {{ ui: any }} props
 */
export function OOCPanel({ ui }) {
  // Subscribe so we rerender as the log grows.
  logVersionSignal.value;

  const inputRef = useRef(null);
  const entries = ooCEntries(ui?.activityLog);

  const send = () => {
    const input = inputRef.current;
    if (!input) return;
    const value = input.value;
    if (!value.trim()) return;
    const prev = chatModeSignal.value;
    chatModeSignal.value = 'ooc';
    try { ui.sendChatMessage?.(value); }
    finally { chatModeSignal.value = prev; }
    input.value = '';
  };

  const onKey = (e) => {
    if (e.key !== 'Enter') return;
    if (e.shiftKey) return;
    if (e.isComposing) return;
    e.preventDefault();
    send();
  };

  return h('div', { class: 'ooc-panel', 'data-ooc-panel': '' }, [
    h('div', { class: 'ooc-panel__header', style: 'display:flex;align-items:center;gap:4px;' },
      [h('span', { class: 'form-label', style: 'margin:0;' }, 'Table talk'), h(HelpIcon, { term: 'ooc' })]),
    h('div', { class: 'ooc-panel__list', key: 'l', 'aria-live': 'polite' },
      entries.length === 0
        ? h('div', { class: 'ooc-panel__empty', 'data-ooc-empty': '' },
            'No out-of-character messages yet.')
        : entries.map((e, i) => h('div', {
            key: i,
            class: 'ooc-panel__entry',
            'data-ooc-entry': '',
            // Body text is already escaped by the log pipeline before
            // it reaches activityLog[].text (see chat-send.js & the
            // m.notice path); rendering with dangerouslySetInnerHTML
            // here mirrors how LogPanel handles the same entries.
            dangerouslySetInnerHTML: { __html: e.text || '' },
          }))
    ),
    h('div', { class: 'ooc-panel__composer', key: 'c' }, [
      h('label', { for: 'ooc-quick-input', class: 'sr-only', key: 'lbl' }, 'OOC message'),
      h('textarea', {
        id: 'ooc-quick-input',
        ref: inputRef,
        class: 'ooc-panel__input',
        rows: 1,
        placeholder: 'Quick OOC message…',
        autocomplete: 'off',
        'aria-label': 'Quick OOC message',
        'data-ooc-input': '',
        onKeyDown: onKey,
        key: 'in',
      }),
      h('button', {
        type: 'button',
        class: 'ooc-panel__send',
        'data-ooc-send': '',
        'aria-label': 'Send OOC message',
        title: 'Send OOC message',
        onClick: send,
        key: 'sn',
      }, 'Send'),
    ]),
  ]);
}
