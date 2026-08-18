/**
 * sync-progress.js - aggregate every sync phase into one progress surface.
 *
 * The app syncs in several phases: connecting / reconnecting, loading room
 * history (the backfill), draining queued writes behind a rate limit, and
 * saving live collaborative state. This module folds
 * them into the single `syncProgressSignal` so one bar (SyncProgress.jsx) can
 * show whatever is in flight, and hide when everything is settled.
 *
 * Phases are kept separately and the highest-priority active one wins, so a
 * brief write-drain during history load doesn't clobber the load label.
 */

import { effect } from '@preact/signals';
import { syncProgressSignal, queueCountSignal, syncOkSignal } from '../../state/ui-signals.js';

// phase -> null (inactive) | { label, done, total }
const _phases = {
  connect: null,
  history: null,
  writes: null,
  live: null,
};
// History outranks connect: during a reconnect-with-backfill the page-by-
// page history label is strictly more informative than a bare "Connecting…".
const PRIORITY = ['history', 'connect', 'writes', 'live'];

function _recompute() {
  for (const name of PRIORITY) {
    const p = _phases[name];
    if (p) {
      syncProgressSignal.value = { active: true, label: p.label, done: p.done ?? 0, total: p.total ?? 0 };
      return;
    }
  }
  if (syncProgressSignal.value.active) {
    syncProgressSignal.value = { active: false, label: '', done: 0, total: 0 };
  }
}

/**
 * Set or clear a sync phase. Pass `null` to clear.
 * @param {'connect'|'history'|'writes'|'live'} name
 * @param {{label: string, done?: number, total?: number} | null} state
 */
export function setSyncPhase(name, state) {
  if (!(name in _phases)) return;
  _phases[name] = state;
  _recompute();
}

/**
 * Wire the phases that derive from existing signals (connect + writes).
 * History is driven by the backfill loop; live by the snapshot scheduler -
 * both call setSyncPhase directly. Returns a dispose fn.
 */
export function wireSyncProgress() {
  let peakQueue = 0;

  const stopConnect = effect(() => {
    // syncOkSignal flips false while (re)connecting, true once live.
    setSyncPhase('connect', syncOkSignal.value ? null : { label: 'Connecting…', total: 0 });
  });

  const stopWrites = effect(() => {
    const n = queueCountSignal.value;
    if (n <= 0) {
      peakQueue = 0;
      setSyncPhase('writes', null);
      return;
    }
    peakQueue = Math.max(peakQueue, n);
    const s = n === 1 ? '' : 's';
    setSyncPhase('writes', { label: `Syncing ${n} change${s}…`, done: peakQueue - n, total: peakQueue });
  });

  return () => {
    stopConnect();
    stopWrites();
    _phases.connect = _phases.history = _phases.writes = _phases.live = null;
    _recompute();
  };
}
