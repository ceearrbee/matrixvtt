
import { h } from 'preact';
import { useState } from 'preact/hooks';
import { logVersionSignal, replyContextSignal } from '../state/ui-signals.js';
import { reactionsSignal } from '../state/signals.js';
import { EmojiPicker } from './EmojiPicker.jsx';
import { sendChatMessage } from './chat-send.js';

const QUICK_REACTS = ['👍', '👎', '❤️', '😂'];
const SYNTH_ENTRY_ICONS = new Set(['🎲', '⚔️', '💔', '💚']);

function TrustedMarkup({ class: cls, html }) {
  return h('span', { class: cls, dangerouslySetInnerHTML: { __html: html } });
}

function authorOf(sender) {
  if (!sender) return 'Someone';
  const idx = sender.indexOf(':');
  return idx > 1 ? sender.slice(1, idx) : sender;
}

async function _sendReaction(ui, targetEventId, key) {
  try {
    await ui.state.sendRoomEvent('m.reaction', {
      'm.relates_to': { rel_type: 'm.annotation', event_id: targetEventId, key },
    });
  } catch (e) {
    ui._toast?.(`Reaction failed: ${e.message}`, 'error');
  }
}

async function _toggleReaction(ui, entry, reaction) {
  const myId = ui.widgetManager?.userId;
  const mine = reaction.senders?.includes(myId);
  if (mine && reaction.myReactionEventId) {
    try {
      await ui.widgetManager.redactEvent(reaction.myReactionEventId);
    } catch (e) {
      ui._toast?.(`Redact failed: ${e.message}`, 'error');
    }
  } else {
    await _sendReaction(ui, entry.eventId, reaction.key);
  }
}

/**
 * Renders a single thread: the root message identified by rootEventId,
 * all replies (entries with threadOf === rootEventId), reaction badges,
 * quick-react buttons, and a reply input.
 *
 * @param {{ ui: object, rootEventId: string }} props
 */
export function ThreadView({ ui, rootEventId }) {
  logVersionSignal.value;

  const [pickerOpenForEventId, setPickerOpenForEventId] = useState(null);
  const [pickerAnchorRect, setPickerAnchorRect] = useState(null);
  const [replyText, setReplyText] = useState('');

  const reactions = reactionsSignal.value;

  const root = ui.activityLog.find((e) => e.eventId === rootEventId) ?? null;
  const replies = ui.activityLog.filter(
    (e) => e.threadOf === rootEventId,
  );

  const openPicker = (eventId, btnEl) => {
    const rect = btnEl?.getBoundingClientRect?.() ?? null;
    setPickerOpenForEventId(eventId);
    setPickerAnchorRect(rect);
  };
  const closePicker = () => {
    setPickerOpenForEventId(null);
    setPickerAnchorRect(null);
  };

  const renderRow = (e) => {
    const rowReactions = e.eventId ? (reactions.get(e.eventId) ?? []) : [];
    const isSynth = SYNTH_ENTRY_ICONS.has(e.icon);
    return h('div', { class: 'log-row thread-row', 'data-event-id': e.eventId ?? undefined, key: e.eventId ?? e.ts }, [
      !isSynth && h('div', { class: 'thread-row__author' }, [
        h('span', { class: 'thread-row__avatar', 'aria-hidden': 'true', title: e.sender || '' },
          authorOf(e.sender).slice(0, 2).toUpperCase()),
        h('span', { class: 'thread-row__author-name', title: e.sender || '' }, authorOf(e.sender)),
        h('span', { class: 'thread-row__ts' }, e.ts),
      ]),
      h('div', { class: 'log-entry' }, [
        isSynth && h('span', { class: 'log-icon' }, e.icon),
        h(TrustedMarkup, { class: 'log-body', html: e.html }),
        isSynth && h('span', { class: 'log-ts' }, e.ts),
      ]),
      rowReactions.length > 0 && h('div', { class: 'log-reactions' },
        rowReactions.map((r) => h('button', {
          key: r.key,
          type: 'button',
          class: 'reaction-badge thread-reaction-badge',
          'data-key': r.key,
          title: r.senders.join(', '),
          onClick: () => _toggleReaction(ui, e, r),
        }, `${r.key} ${r.count}`)),
      ),
      e.eventId && !SYNTH_ENTRY_ICONS.has(e.icon) && h('div', { class: 'log-quick-react' }, [
        ...QUICK_REACTS.map((char) => h('button', {
          key: char,
          type: 'button',
          class: 'quick-react-btn',
          title: `React with ${char}`,
          'aria-label': `React with ${char}`,
          onClick: () => _sendReaction(ui, e.eventId, char),
        }, char)),
        h('button', {
          type: 'button',
          class: 'log-picker-btn',
          title: 'More reactions',
          'aria-label': 'Open emoji picker',
          onClick: (ev) => {
            if (pickerOpenForEventId === e.eventId) {
              closePicker();
            } else {
              openPicker(e.eventId, ev.currentTarget);
            }
          },
        }, '+'),
      ]),
      e.eventId && pickerOpenForEventId === e.eventId && h(EmojiPicker, {
        anchorRect: pickerAnchorRect,
        onPick: (char) => {
          _sendReaction(ui, e.eventId, char);
          closePicker();
        },
        onClose: closePicker,
      }),
    ]);
  };

  const onSendReply = async (e) => {
    e.preventDefault();
    const text = replyText.trim();
    if (!text) return;
    replyContextSignal.value = {
      rootEventId,
      rootSender: root?.sender ?? '',
      rootPreview: (root?.text ?? '').slice(0, 60),
    };
    await sendChatMessage(ui, text);
    setReplyText('');
  };

  if (!root && replies.length === 0) {
    return h('div', { class: 'thread-view thread-view--empty' }, 'Thread not found.');
  }

  return h('div', { class: 'thread-view' }, [
    root && h('div', { class: 'thread-view__root' }, renderRow(root)),
    replies.length > 0 && h('div', { class: 'thread-view__replies' }, replies.map(renderRow)),
    h('form', { class: 'thread-view__reply-input', onSubmit: onSendReply }, [
      h('label', { for: 'thread-reply-input', class: 'sr-only' }, 'Reply in thread'),
      h('input', {
        type: 'text',
        id: 'thread-reply-input',
        class: 'thread-reply-input',
        placeholder: 'Reply…',
        value: replyText,
        autocomplete: 'off',
        'aria-label': 'Reply in thread',
        onInput: (ev) => setReplyText(ev.target.value),
      }),
      h('button', {
        type: 'submit',
        class: 'dbt dbt--sm',
        disabled: !replyText.trim(),
      }, 'Send'),
    ]),
  ]);
}
