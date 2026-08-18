/**
 * Guardrails for the irreversible / socially-sensitive actions in the
 * header: kicking or banning a member. Each routes through a confirm
 * before the action fires, so a single mis-click can't eject a player
 * mid-session. Low-risk toggles stay one-click and do not belong here.
 * (Leaving the room confirms inside session.leaveRoom, the funnel for
 * every LEAVE_ROOM dispatch.)
 *
 * Pure wiring over `confirmAsync` (Preact modal with busy + error state);
 * extracted from Header.jsx so the guard logic is testable without a DOM.
 */
import { confirmAsync } from './confirm-dialogs.jsx';

export function confirmKick(ui, userId, displayName) {
  const who = displayName || userId;
  return confirmAsync(
    `Remove ${who} from this room? They can rejoin if the room is public.`,
    () => ui.kickUser?.(userId),
    { title: 'Kick from room', confirmText: 'Kick', busyText: 'Kicking…', confirmClass: 'dbt--danger', id: 'confirm-kick' },
  );
}

export function confirmBan(ui, userId, displayName) {
  const who = displayName || userId;
  return confirmAsync(
    `Ban ${who}? They are removed now and cannot rejoin until you unban them.`,
    () => ui.banUser?.(userId),
    { title: 'Ban from room', confirmText: 'Ban', busyText: 'Banning…', confirmClass: 'dbt--danger', id: 'confirm-ban' },
  );
}
