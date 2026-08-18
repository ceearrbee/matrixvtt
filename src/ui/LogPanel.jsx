/**
 * LogPanel.jsx - chat log surface.
 *
 * Discord-style author grouping: consecutive entries from the same
 * sender within a ~5-minute window collapse into ONE group with a
 * single header (color dot + display name + timestamp) and stacked
 * message bodies underneath. Synthetic entries (dice / damage / heal /
 * combat / map) never group - each renders as its own row tinted as
 * "system" output.
 *
 * Scene-root entries render as cinematic cards with eyebrow + title +
 * opening, and they interrupt grouping so a new chapter naturally
 * starts a fresh conversation.
 *
 * Filter + search live behind a popover (`LogControls`) so the resting
 * surface looks like a conversation, not a query tool.
 *
 * Hover-revealed actions (reactions, quick-react, reply, thread
 * toggle) keep the resting state calm.
 */

import { h } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import {
  logVersionSignal, replyContextSignal, tablePhaseSignal,
} from '../state/ui-signals.js';
import { reactionsSignal } from '../state/signals.js';
import { loadMoreHistory } from './log-panel.js';
import { EmojiPicker } from './EmojiPicker.jsx';
import { LogControls } from './LogControls.jsx';
import { Avatar } from './Avatar.jsx';
import { EmptyState } from './EmptyState.jsx';
import { isNarrativeLog } from './mode-registry.js';
import { buildLogItems, SYNTH_ENTRY_ICONS } from './log-grouping.js';

/**
 * Log-entry body sink. Entries feed in from `ui._log(icon, html)` and
 * from `loadMoreHistory`'s historical-message replay in log-panel.js.
 * Every producer is responsible for escape-sanitising user-authored
 * fields (sender, body, token name, NPC name, action label) via `esc()`
 * before building the HTML fragment. Lock-in tests live in
 * src/__tests__/logPanelEscaping.test.js. Do not pipe raw user input
 * through this component.
 */
function TrustedMarkup({ class: cls, html }) {
  return h('span', { class: cls, dangerouslySetInnerHTML: { __html: html } });
}

const QUICK_REACTS = ['👍', '👎', '❤️', '😂'];

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

function displayNameFor(sender) {
  if (!sender) return 'System';
  const idx = sender.indexOf(':');
  return idx > 1 ? sender.slice(1, idx) : sender;
}

export function LogPanel({ ui }) {
  const logVersion = logVersionSignal.value;
  const [search, setSearch] = useState(ui._logSearch || '');
  const [filter, setFilter] = useState(ui._logFilter || 'all');

  useEffect(() => {
    if (ui._logSeeded) return;
    ui._logSeeded = true;
    const api = ui.widgetManager?.getApi?.();
    if (!api?.getMessages) return;
    let mounted = true;
    Promise.resolve(loadMoreHistory(ui)).finally(() => {
      if (!mounted) ui._logLoadingHistory = false;
    });
    return () => { mounted = false; };
  }, []);
  const [pickerOpenForEventId, setPickerOpenForEventId] = useState(null);
  const [pickerAnchorRect, setPickerAnchorRect] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const [expanded, setExpanded] = useState(/** @type {Record<string, boolean>} */ ({}));

  // Keyed on the log's version signal rather than the array, which is
  // mutated in place by ui._log(). The picker / collapse / expand state
  // below re-renders this panel often and none of it changes the grouping,
  // so without the memo every hover-action click re-walked up to 2000
  // entries through three passes.
  const { items, threads } = useMemo(
    () => buildLogItems(ui.activityLog, filter, search),
    [logVersion, filter, search, ui.activityLog],
  );

  const api = ui.widgetManager?.getApi?.();
  const canLoadMore = !!api?.getMessages && api.hasMoreHistory !== false;
  const isNarrative = isNarrativeLog(tablePhaseSignal.value);

  const onSearchChange = (v) => { setSearch(v); ui._logSearch = v; };
  const onFilterChange = (v) => { setFilter(v); ui._logFilter = v; };

  const reactions = reactionsSignal.value;

  const openPicker = (eventId, btnEl) => {
    const rect = btnEl?.getBoundingClientRect?.() ?? null;
    setPickerOpenForEventId(eventId);
    setPickerAnchorRect(rect);
  };
  const closePicker = () => {
    setPickerOpenForEventId(null);
    setPickerAnchorRect(null);
  };

  const toggleThread = (rootId) => {
    setCollapsed((prev) => ({ ...prev, [rootId]: !prev[rootId] }));
  };
  const toggleExpanded = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const renderActions = (e) => {
    if (!e.eventId || SYNTH_ENTRY_ICONS.has(e.icon)) return null;
    return h('div', { class: 'log-actions' }, [
      ...QUICK_REACTS.map((char) => h('button', {
        key: char,
        type: 'button',
        class: 'log-actions__react',
        title: `React with ${char}`,
        'aria-label': `React with ${char}`,
        onClick: () => _sendReaction(ui, e.eventId, char),
      }, char)),
      h('button', {
        type: 'button',
        class: 'log-actions__more',
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
      h('button', {
        type: 'button',
        class: 'log-actions__reply',
        title: 'Reply in thread',
        'aria-label': 'Reply in thread',
        onClick: () => {
          replyContextSignal.value = {
            rootEventId: e.threadOf || e.eventId,
            rootSender: e.sender,
            rootPreview: (e.text || '').slice(0, 60),
          };
        },
      }, '↪'),
    ]);
  };

  const renderRowReactions = (e) => {
    const rowReactions = e.eventId ? (reactions.get(e.eventId) ?? []) : [];
    if (rowReactions.length === 0) return null;
    return h('div', { class: 'log-reactions' },
      rowReactions.map((r) => h('button', {
        key: r.key,
        type: 'button',
        class: 'reaction-badge',
        'data-key': r.key,
        title: r.senders.join(', '),
        onClick: () => _toggleReaction(ui, e, r),
      }, `${r.key} ${r.count}`)),
    );
  };

  const renderMsgBody = (e, isFirstInGroup) => {
    const longKey = e.eventId || e.ts;
    const isExpanded = !!expanded[longKey];
    const bodyClass = `log-body${e.long ? ' log-body--long' : ''}${e.long && isExpanded ? ' log-body--expanded' : ''}`;
    return h('div', {
      class: `log-msg${isFirstInGroup ? ' log-msg--first' : ''}`,
      'data-event-id': e.eventId ?? undefined,
      key: e.eventId ?? e.ts,
    }, [
      h(TrustedMarkup, { class: bodyClass, html: e.html }),
      e.long && h('button', {
        type: 'button',
        class: 'log-body__more',
        'aria-expanded': String(isExpanded),
        'aria-label': isExpanded ? 'Show less of this entry' : 'Show more of this entry',
        onClick: () => toggleExpanded(longKey),
      }, isExpanded ? 'Show less' : 'Show more'),
      renderRowReactions(e),
      renderActions(e),
      e.eventId && pickerOpenForEventId === e.eventId && h(EmojiPicker, {
        anchorRect: pickerAnchorRect,
        onPick: (char) => { _sendReaction(ui, e.eventId, char); closePicker(); },
        onClose: closePicker,
      }),
    ]);
  };

  const renderGroup = (group) => {
    const head = group.head;
    const name = displayNameFor(group.sender);
    const lastTs = group.entries[group.entries.length - 1]?.ts;
    // Find the sender's primary token (if any) so we can show their
    // portrait/color. Token lookup is best-effort - falls back to the
    // hash-hue monogram in Avatar when nothing is found.
    const senderToken = group.sender && ui.state?.tokens
      ? Array.from(ui.state.tokens.values()).find((t) => t?.owner_user_id === group.sender)
      : null;
    return h('div', {
      class: 'log-group',
      'data-sender': group.sender,
      key: head.eventId ?? `${group.sender}-${head.ts}`,
    }, [
      h('div', { class: 'log-group__header' }, [
        h(Avatar, {
          imageUrl: senderToken?.image_url,
          name,
          color: senderToken?.color,
          size: 20,
        }),
        h('span', { class: 'log-group__name' }, name),
        h('span', { class: 'log-group__ts' }, lastTs || head.ts),
      ]),
      h('div', { class: 'log-group__bodies' },
        group.entries.map((e, i) => renderMsgBody(e, i === 0))),
    ]);
  };

  const renderSceneCard = (e) => {
    const title = e.sceneTitle || 'Scene';
    return h('div', {
      class: 'log-scene-card',
      'data-event-id': e.eventId ?? undefined,
      key: e.eventId ?? `scene-${e.ts}`,
    }, [
      h('div', { class: 'log-scene-card__eyebrow' }, 'Chapter'),
      h('div', { class: 'log-scene-card__title' }, title),
      // Body may already contain the scene-root wrapper from
      // formatSceneRootBody; render via TrustedMarkup either way.
      h(TrustedMarkup, { class: 'log-scene-card__body', html: e.html }),
      h('span', { class: 'log-scene-card__ts' }, e.ts),
    ]);
  };

  const renderSynthRow = (e) => {
    const longKey = e.eventId || e.ts;
    const isExpanded = !!expanded[longKey];
    const bodyClass = `log-body${e.long ? ' log-body--long' : ''}${e.long && isExpanded ? ' log-body--expanded' : ''}`;
    return h('div', {
      class: 'log-synth-row',
      'data-event-id': e.eventId ?? undefined,
      key: e.eventId ?? e.ts,
    }, [
      h('span', { class: 'log-icon' }, e.icon),
      h(TrustedMarkup, { class: bodyClass, html: e.html }),
      e.long && h('button', {
        type: 'button',
        class: 'log-body__more',
        onClick: () => toggleExpanded(longKey),
      }, isExpanded ? 'Show less' : 'Show more'),
      h('span', { class: 'log-ts' }, e.ts),
    ]);
  };

  const renderItem = (item) => {
    if (item.kind === 'group') {
      // Thread replies still live under the group's *header* entry; if
      // any entry in the group has replies, surface a thread toggle at
      // the bottom of the group.
      const headEventId = item.head.eventId;
      const replies = headEventId ? (threads[headEventId] ?? []) : [];
      const node = renderGroup(item);
      if (replies.length === 0) return node;
      const isCollapsed = collapsed[headEventId] === true;
      const label = `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`;
      return h('div', { key: `g-${headEventId}` }, [
        node,
        h('div', { class: 'log-thread' }, [
          h('button', {
            type: 'button',
            class: 'log-thread-toggle',
            onClick: () => toggleThread(headEventId),
          }, label),
          !isCollapsed && h('div', {
            class: 'log-thread-replies',
            style: 'padding-left: var(--space-md); border-left: 2px solid var(--color-border-tertiary);',
          }, replies.map((r) => renderMsgBody(r, true))),
        ]),
      ]);
    }
    if (item.kind === 'scene') return renderSceneCard(item.entry);
    if (item.kind === 'synth') return renderSynthRow(item.entry);
    return null;
  };

  return h('div', {
    class: `log-panel log-panel--social${isNarrative ? ' log-panel--narrative' : ''}`,
  }, [
    h(LogControls, {
      search, filter,
      onSearchChange, onFilterChange,
      onLoadMore: () => loadMoreHistory(ui),
      canLoadMore,
      loading: !!ui._logLoadingHistory,
    }),
    h('div', { class: 'log-panel__feed' },
      items.length === 0
        ? [h(EmptyState, {
            key: 'empty',
            glyph: '💬',
            title: search || filter !== 'all' ? 'No entries match' : 'Quiet here',
            body: search || filter !== 'all'
              ? 'Try clearing the filter or search to see the full log.'
              : 'Chat, dice rolls, and combat events will appear here as the session unfolds.',
          })]
        : items.map(renderItem),
    ),
  ]);
}
