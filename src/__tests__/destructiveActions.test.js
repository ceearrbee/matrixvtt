/**
 * Destructive-action guardrails: Kick / Ban / Leave must route through a
 * confirm before the irreversible/social action fires. The confirm copy
 * names the target and uses the danger vocabulary; the action only runs
 * when the user confirms.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../ui/confirm-dialogs.jsx', () => ({ confirmAsync: vi.fn() }));
import { confirmAsync } from '../ui/confirm-dialogs.jsx';
import { confirmKick, confirmBan, confirmLeave } from '../ui/destructive-actions.js';

beforeEach(() => { confirmAsync.mockReset(); });

describe('destructive-action guardrails', () => {
  it('confirmKick opens a danger confirm naming the user, and only kicks on confirm', () => {
    const ui = { kickUser: vi.fn() };
    confirmKick(ui, '@bob:server', 'Bob');

    expect(confirmAsync).toHaveBeenCalledTimes(1);
    const [message, onConfirm, opts] = confirmAsync.mock.calls[0];
    expect(message).toContain('Bob');
    expect(opts).toMatchObject({ title: 'Kick from room', confirmText: 'Kick', confirmClass: 'dbt--danger' });

    // The kick must NOT fire until the user confirms.
    expect(ui.kickUser).not.toHaveBeenCalled();
    onConfirm();
    expect(ui.kickUser).toHaveBeenCalledWith('@bob:server');
  });

  it('confirmKick falls back to the user id when no display name', () => {
    const ui = { kickUser: vi.fn() };
    confirmKick(ui, '@bob:server', '');
    expect(confirmAsync.mock.calls[0][0]).toContain('@bob:server');
  });

  it('confirmBan opens a danger confirm naming the user, and only bans on confirm', () => {
    const ui = { banUser: vi.fn() };
    confirmBan(ui, '@eve:server', 'Eve');

    const [message, onConfirm, opts] = confirmAsync.mock.calls[0];
    expect(message).toContain('Eve');
    expect(opts).toMatchObject({ title: 'Ban from room', confirmText: 'Ban', confirmClass: 'dbt--danger' });
    expect(ui.banUser).not.toHaveBeenCalled();
    onConfirm();
    expect(ui.banUser).toHaveBeenCalledWith('@eve:server');
  });

  it('confirmLeave runs the provided leave action only on confirm', () => {
    const onLeave = vi.fn();
    confirmLeave(onLeave);

    const [, onConfirm, opts] = confirmAsync.mock.calls[0];
    expect(opts).toMatchObject({ title: 'Leave room', confirmText: 'Leave', confirmClass: 'dbt--danger' });
    expect(onLeave).not.toHaveBeenCalled();
    onConfirm();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
