/**
 * SyncProgress.jsx - the unified sync progress bar.
 *
 * Renders a slim bar (determinate when a total is known, animated/
 * indeterminate otherwise) for whatever sync phase is active, and nothing
 * when idle. Fed by `sync-progress.js` via `syncProgressSignal`.
 */
import { h } from 'preact';
import { syncProgressSignal } from '../../state/ui-signals.js';

export function SyncProgress() {
  const { active, label, done, total } = syncProgressSignal.value;
  if (!active) return null;

  const determinate = total > 0;
  const pct = determinate ? Math.min(100, Math.round((done / total) * 100)) : 0;

  return h('div', {
    class: 'sync-progress', role: 'status', 'aria-live': 'polite',
    'aria-label': label,
  }, [
    h('div', { class: 'sync-progress__track' },
      h('div', {
        class: `sync-progress__fill${determinate ? '' : ' sync-progress__fill--indeterminate'}`,
        style: determinate ? `width:${pct}%` : '',
        role: 'progressbar',
        'aria-valuenow': determinate ? String(pct) : undefined,
        'aria-valuemin': '0',
        'aria-valuemax': '100',
      }),
    ),
    h('span', { class: 'sync-progress__label' }, label),
  ]);
}
