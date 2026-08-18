/**
 * Footer action row for the Settings modal: Save / Cancel / Reload /
 * Restore from autosave / Delete-session. Each destructive action is
 * gated behind ModalFactory.confirmAsync so accidental clicks don't
 * blow away local state.
 */
import { h } from 'preact';
import { confirmAsync } from '../confirm-dialogs.jsx';
import { loadSnapshot, restoreSnapshot } from '../../utils/state-snapshot.js';

export function SettingsActions({ ui, ops, isGM, overlayRef, closeModal }) {
  return h('div', { class: 'form-actions', style: 'margin-top: 24px; flex-direction: column; gap: 8px;' }, [
    h('div', { style: 'display: flex; gap: 8px;' }, [
      h('button', { type: 'button', class: 'dbt', onClick: () => closeModal(overlayRef.current) }, 'Cancel'),
      h('button', { type: 'submit', class: 'dbt btn-primary', style: 'flex: 1;' }, 'Save Settings'),
    ]),
    h('button', {
      type: 'button', class: 'dbt',
      style: 'width: 100%;',
      title: 'Discard local cache and re-fetch all room state from the homeserver. Useful after sync hiccups.',
      onClick: () => {
        closeModal(overlayRef.current);
        confirmAsync(
          'Reload from server? Discards any in-flight local edits and re-fetches all room state. Safe to use any time.',
          async () => {
            if (typeof ui.state?.loadInitialState === 'function') {
              await ui.state.loadInitialState();
            } else {
              window.location.reload();
            }
          },
          { title: 'Reload from server', confirmText: 'Reload', busyText: 'Reloading…' },
        );
      },
    }, '↻ Reload from server'),
    h('button', {
      type: 'button', class: 'dbt',
      style: 'width: 100%;',
      title: 'Restore the most recent local autosave. Reverts any state changes since the snapshot was taken.',
      onClick: async () => {
        const userId = ui.widgetManager?.userId;
        const roomId = ui.widgetManager?.roomId;
        const snap = (userId && roomId) ? await loadSnapshot(userId, roomId) : null;
        if (!snap) {
          ui._toast?.('No local autosave yet. Snapshots are taken every 5 minutes.', 'info');
          return;
        }
        const ageMin = Math.round((Date.now() - snap.saved_at) / 60_000);
        closeModal(overlayRef.current);
        confirmAsync(
          `Restore the autosave from ${ageMin} minute${ageMin === 1 ? '' : 's'} ago? Local state changes since then will be lost. The snapshot is local only and won't push to the server.`,
          async () => {
            restoreSnapshot(ui.state, snap);
            ui.render?.();
          },
          { title: 'Restore from autosave', confirmText: 'Restore', busyText: 'Restoring…' },
        );
      },
    }, '⏪ Restore from local autosave'),
    isGM && h('button', {
      type: 'button', class: 'dbt',
      style: 'width: 100%; color: var(--color-text-danger); border-color: var(--color-border-danger);',
      onClick: () => {
        closeModal(overlayRef.current);
        confirmAsync(
          'Delete this session? Permanent erase!',
          () => ops.deleteSession(),
          { title: 'Delete Session', confirmText: 'Delete', busyText: 'Deleting…', confirmClass: 'btn-primary' },
        );
      },
    }, 'Delete Session'),
  ]);
}
