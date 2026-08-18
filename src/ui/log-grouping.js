/**
 * src/ui/log-grouping.js - pure filter + grouping pipeline for the chat log.
 *
 * Extracted out of LogPanel.jsx so the component can memoize it: the panel
 * re-renders on emoji-picker opens, thread collapses, long-message expands
 * and reaction arrivals, none of which change the grouped output, and the
 * pipeline walks up to MAX_LOG_ENTRIES (2000) entries per pass.
 *
 * Grouping rules, unchanged from the inline version:
 *   - replies (`threadOf`) nest under their root; orphans are promoted to
 *     top level so they still render,
 *   - consecutive entries from one sender within GROUP_WINDOW_MIN collapse
 *     into one `{ kind: 'group' }` item,
 *   - scene roots and synthetic entries (dice / combat / map) always stand
 *     alone and interrupt an open group.
 */

const GROUP_WINDOW_MIN = 5;

// Synthesised log entries (rolls, combat events) carry these icons.
// They render as standalone "system" rows, never group with chat, and
// don't carry reaction/reply affordances.
export const SYNTH_ENTRY_ICONS = new Set(['🎲', '⚔️', '💔', '💚', '🗺️']);

export function entryMatchesFilter(entry, filter) {
  if (filter === 'chat') return entry.icon === '💬';
  if (filter === 'dice') return entry.icon === '🎲';
  if (filter === 'combat') return ['⚔️', '💔', '💚'].includes(entry.icon);
  if (filter === 'map') return entry.icon === '🗺️';
  return true;
}

/**
 * Parse an `HH:MM` timestamp into a minutes-of-day number for the
 * grouping window comparison. Returns NaN if the format doesn't match,
 * which the comparison interprets as "different group" (safe default).
 */
function tsMinutes(ts) {
  if (typeof ts !== 'string') return NaN;
  const m = ts.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

function groupByThread(entries) {
  const top = [];
  /** @type {Record<string, Array<any>>} */
  const threads = {};
  const topIds = new Set();

  for (const entry of entries) {
    if (entry.threadOf) {
      (threads[entry.threadOf] ??= []).push(entry);
    } else {
      top.push(entry);
      if (entry.eventId) topIds.add(entry.eventId);
    }
  }

  const orphans = [];
  for (const [rootId, replies] of Object.entries(threads)) {
    if (!topIds.has(rootId)) {
      orphans.push(...replies);
      delete threads[rootId];
    }
  }

  return { top: [...top, ...orphans], threads };
}

/**
 * Walk entries and emit either a chat group (header + stacked bodies from
 * one sender) or a standalone synth / scene row.
 * @returns {Array<Record<string, any>>}
 */
function groupByAuthor(entries) {
  const out = [];
  let current = null; // open chat group

  const close = () => {
    if (current) {
      out.push({ kind: 'group', sender: current.sender, head: current.head, entries: current.entries });
      current = null;
    }
  };

  for (const e of entries) {
    const isScene = e.isSceneRoot === true;
    const isSynth = SYNTH_ENTRY_ICONS.has(e.icon);
    if (isScene || isSynth) {
      close();
      out.push({ kind: isScene ? 'scene' : 'synth', entry: e });
      continue;
    }
    // Chat entries always render through the group/msg path so the
    // hover-revealed action bar attaches. A null sender gets its own
    // single-message group (label falls back to "System").
    const t = tsMinutes(e.ts);
    const sameAsCurrent = current
      && current.sender === e.sender
      && current.sender != null
      && Number.isFinite(t)
      && Number.isFinite(current.lastTs)
      && t - current.lastTs <= GROUP_WINDOW_MIN;
    if (sameAsCurrent) {
      current.entries.push(e);
      current.lastTs = t;
    } else {
      close();
      current = { sender: e.sender ?? null, head: e, entries: [e], lastTs: t };
    }
  }
  close();
  return out;
}

/**
 * Filter the activity log by search text + filter name, then group it.
 * @param {Array<Record<string, any>>|undefined} activityLog
 * @param {string} filter
 * @param {string} search raw search box text; lowercased here
 * @returns {{ items: Array<Record<string, any>>, threads: Record<string, Array<any>> }}
 */
export function buildLogItems(activityLog, filter, search) {
  if (!Array.isArray(activityLog)) return { items: [], threads: {} };
  const q = (search || '').toLowerCase();
  const filtered = activityLog.filter((e) =>
    (!q || (e.text || '').toLowerCase().includes(q)) && entryMatchesFilter(e, filter));
  const { top, threads } = groupByThread(filtered);
  return { items: groupByAuthor(top), threads };
}
