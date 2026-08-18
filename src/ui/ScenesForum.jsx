/**
 * ScenesForum.jsx - forum-style list of scene-threads in the current
 * room. Reads `ui.activityLog`, filters to entries marked
 * `isSceneRoot`, and renders one card per scene with metadata, a
 * reply count, and Enter / Leave / Expand affordances.
 *
 * Pairs with LogContainer's [Live | Scenes] sub-tabs. The forum is
 * the "re-enter a scene after leaving" surface: even after the active-
 * scene signal is cleared, every scene root still in the activity log
 * shows up here with an Enter button.
 */

import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import { logVersionSignal, activeSceneSignal } from '../state/ui-signals.js';
import { HelpIcon } from './HelpIcon.jsx';
import { ThreadView } from './ThreadView.jsx';
import { EmptyState } from './EmptyState.jsx';

function relativeTs(ts) {
  // The log entry stores ts as a localized "HH:MM" string already. We
  // surface that as-is for now (no absolute date) since the activity
  return ts || '';
}

function displayNameFor(sender) {
  if (!sender) return 'Someone';
  // Matrix user ids look like @local:server.tld - show the local part
  // for the card meta line; the full id stays in the title attribute.
  const idx = sender.indexOf(':');
  return idx > 1 ? sender.slice(1, idx) : sender;
}

function authorInitials(sender) {
  const name = displayNameFor(sender);
  return name.slice(0, 2).toUpperCase();
}

function SceneCard({ ui, entry, replyCount, active, expanded, onToggleExpand }) {
  const sender = entry.sender;
  return h('div', {
    class: `scene-card${active ? ' scene-card--active' : ''}`,
    'data-event-id': entry.eventId,
  }, [
    h('div', { class: 'scene-card__head' }, [
      h('span', {
        class: 'scene-card__avatar',
        'aria-hidden': 'true',
        title: sender || '',
      }, authorInitials(sender)),
      h('span', { class: 'scene-card__title' }, entry.sceneTitle || 'Untitled scene'),
      active && h('span', { class: 'scene-card__badge', 'aria-label': 'Currently active scene' }, 'Active'),
    ]),
    h('div', { class: 'scene-card__meta' }, [
      h('span', { title: sender || '' }, `Started by ${displayNameFor(sender)}`),
      ' · ',
      h('span', null, relativeTs(entry.ts)),
      ' · ',
      h('span', null, `${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}`),
    ]),
    entry.html
      ? h('div', {
          class: `scene-card__body${expanded ? ' scene-card__body--full' : ''}`,
          dangerouslySetInnerHTML: { __html: entry.html },
        })
      : null,
    h('div', { class: 'scene-card__actions' }, [
      active
        ? h('button', {
            type: 'button',
            class: 'dbt dbt--sm',
            onClick: () => ui.leaveScene?.(),
          }, 'Leave')
        : h('button', {
            type: 'button',
            class: 'dbt dbt--sm btn-primary',
            onClick: () => ui.enterScene?.(entry.eventId, entry.sceneTitle || 'Scene'),
          }, 'Enter'),
      h('button', {
        type: 'button',
        class: 'dbt dbt--sm',
        'aria-expanded': String(expanded),
        'aria-label': `${expanded ? 'Hide' : 'Expand'} thread for ${entry.sceneTitle || 'this scene'}`,
        onClick: onToggleExpand,
      }, expanded ? 'Hide thread' : 'Expand thread'),
    ]),
    expanded && h('div', { class: 'scene-card__thread' },
      h(ThreadView, { ui, rootEventId: entry.eventId }),
    ),
  ]);
}

export function ScenesForum({ ui }) {
  // Subscribe to log + active-scene so the card list and the badge
  // stay in sync with new entries and signal flips.
  logVersionSignal.value;
  const activeSceneId = activeSceneSignal.value?.eventId ?? null;
  const [expanded, setExpanded] = useState(/** @type {Record<string, boolean>} */ ({}));

  const scenes = useMemo(() => {
    const list = (ui.activityLog || []).filter((e) => e?.isSceneRoot && e.eventId);
    // activityLog is most-recent-first (chat-log unshifts new entries).
    // Keep that ordering so the latest scene tops the list.
    return list;
  }, [logVersionSignal.value]);

  const replyCounts = useMemo(() => {
    const counts = new Map();
    for (const e of (ui.activityLog || [])) {
      if (e?.threadOf) counts.set(e.threadOf, (counts.get(e.threadOf) || 0) + 1);
    }
    return counts;
  }, [logVersionSignal.value]);

  const helpRow = h('div', {
    class: 'scenes-forum__help',
    style: 'display:flex;justify-content:flex-end;padding:2px 6px 0;',
  }, h(HelpIcon, { term: 'scene' }));

  if (scenes.length === 0) {
    return h('div', { class: 'scenes-forum' },
      helpRow,
      h(EmptyState, {
        eyebrow: 'The forum',
        heading: 'No scenes yet',
        body: 'Tap the Scene button above the chat input to open a thread for play-by-post. Anything you send while inside a scene threads under it, so the live timeline stays uncluttered.',
      }),
    );
  }

  return h('div', { class: 'scenes-forum' },
    helpRow,
    h('div', { role: 'list' }, scenes.map((entry) => h(SceneCard, {
      key: entry.eventId,
      ui,
      entry,
      replyCount: replyCounts.get(entry.eventId) || 0,
      active: entry.eventId === activeSceneId,
      expanded: !!expanded[entry.eventId],
      onToggleExpand: () => setExpanded((p) => ({ ...p, [entry.eventId]: !p[entry.eventId] })),
    }))),
  );
}
