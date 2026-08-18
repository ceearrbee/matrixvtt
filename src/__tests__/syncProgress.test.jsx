/**
 * Unified sync-progress surface: the controller folds connect / history /
 * writes / live phases into one signal (highest-priority active phase wins),
 * and the SyncProgress bar renders it (determinate vs indeterminate) or
 * nothing when idle.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup } from '@testing-library/preact';
import { setSyncPhase, wireSyncProgress } from '../ui/sync/sync-progress.js';
import { SyncProgress } from '../ui/sync/SyncProgress.jsx';
import { syncProgressSignal, queueCountSignal, syncOkSignal } from '../state/ui-signals.js';

beforeEach(() => {
  for (const p of /** @type {const} */ (['connect', 'history', 'writes', 'live'])) setSyncPhase(p, null);
  syncOkSignal.value = true;
  queueCountSignal.value = 0;
});
afterEach(() => cleanup());

describe('sync-progress controller', () => {
  it('the highest-priority active phase wins', () => {
    setSyncPhase('writes', { label: 'Syncing…', done: 1, total: 4 });
    expect(syncProgressSignal.value).toMatchObject({ active: true, label: 'Syncing…' });

    setSyncPhase('history', { label: 'Loading history…', done: 2, total: 25 });
    expect(syncProgressSignal.value.label).toBe('Loading history…'); // history > writes

    setSyncPhase('history', null);
    expect(syncProgressSignal.value.label).toBe('Syncing…'); // falls back to writes

    setSyncPhase('writes', null);
    expect(syncProgressSignal.value.active).toBe(false);
  });

  it('history outranks connect so a reconnect does not mask backfill detail', () => {
    setSyncPhase('connect', { label: 'Connecting…', total: 0 });
    setSyncPhase('history', { label: 'Loading history - page 3 of 12…', done: 3, total: 12 });
    expect(syncProgressSignal.value.label).toBe('Loading history - page 3 of 12…');

    setSyncPhase('history', null);
    expect(syncProgressSignal.value.label).toBe('Connecting…');
  });

  it('wires queue drain and connect from their signals; dispose clears all', () => {
    const dispose = wireSyncProgress();
    expect(syncProgressSignal.value.active).toBe(false); // syncOk=true, queue=0

    queueCountSignal.value = 3;
    expect(syncProgressSignal.value).toMatchObject({ active: true, label: 'Syncing 3 changes…', done: 0, total: 3 });

    queueCountSignal.value = 1; // two of the peak-3 drained
    expect(syncProgressSignal.value).toMatchObject({ label: 'Syncing 1 change…', done: 2, total: 3 });

    syncOkSignal.value = false; // connect outranks writes
    expect(syncProgressSignal.value.label).toBe('Connecting…');

    dispose();
    expect(syncProgressSignal.value.active).toBe(false);
  });
});

describe('SyncProgress component', () => {
  it('renders nothing when idle', () => {
    syncProgressSignal.value = { active: false, label: '', done: 0, total: 0 };
    const { container } = render(h(SyncProgress, {}));
    expect(container.querySelector('.sync-progress')).toBeNull();
  });

  it('renders a determinate bar with width and label', () => {
    syncProgressSignal.value = { active: true, label: 'Loading history…', done: 1, total: 4 };
    const { container } = render(h(SyncProgress, {}));
    expect(container.querySelector('.sync-progress').textContent).toContain('Loading history…');
    const fill = container.querySelector('.sync-progress__fill');
    expect(fill.style.width).toBe('25%');
    expect(fill.classList.contains('sync-progress__fill--indeterminate')).toBe(false);
  });

  it('renders an indeterminate bar when total is 0', () => {
    syncProgressSignal.value = { active: true, label: 'Connecting…', done: 0, total: 0 };
    const { container } = render(h(SyncProgress, {}));
    expect(container.querySelector('.sync-progress__fill--indeterminate')).not.toBeNull();
  });
});
