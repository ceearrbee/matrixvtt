/**
 * KnockRequests - GM-only pending-knock list in the party roster.
 * Approve invites the knocker; Deny kicks the knock away. Both ride
 * the rate-limit retry helper and clear the row on success.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/preact';
import { KnockRequests } from '../ui/KnockRequests.jsx';
import { pendingKnocksSignal } from '../state/signals.js';

afterEach(() => {
  cleanup();
  pendingKnocksSignal.value = [];
});

function makeUi({ isGM = true, inviteUser = null, kickUser = null } = {}) {
  return {
    state: {
      isGM: () => isGM,
      get pendingKnocks() { return pendingKnocksSignal.value; },
      set pendingKnocks(v) { pendingKnocksSignal.value = v; },
    },
    widgetManager: {
      inviteUser: inviteUser ?? vi.fn(async () => {}),
      kickUser: kickUser ?? vi.fn(async () => {}),
    },
    _toast: vi.fn(),
  };
}

const ANN = { userId: '@ann:hs', displayname: 'Ann', reason: 'Thursday group' };

describe('KnockRequests', () => {
  it('renders nothing for players even when knocks are pending', () => {
    pendingKnocksSignal.value = [ANN];
    const { container } = render(h(KnockRequests, { ui: makeUi({ isGM: false }) }));
    expect(container.textContent).toBe('');
  });

  it('renders nothing when no knocks are pending', () => {
    const { container } = render(h(KnockRequests, { ui: makeUi() }));
    expect(container.textContent).toBe('');
  });

  it('lists a pending knock with name, id, and reason', () => {
    pendingKnocksSignal.value = [ANN];
    const { container } = render(h(KnockRequests, { ui: makeUi() }));
    expect(container.textContent).toContain('Ann');
    expect(container.textContent).toContain('@ann:hs');
    expect(container.textContent).toContain('Thursday group');
  });

  it('Approve invites the knocker and clears the row', async () => {
    pendingKnocksSignal.value = [ANN];
    const ui = makeUi();
    const { getByRole, container } = render(h(KnockRequests, { ui }));
    fireEvent.click(getByRole('button', { name: /approve/i }));
    await waitFor(() => {
      expect(ui.widgetManager.inviteUser).toHaveBeenCalledWith('@ann:hs');
      expect(pendingKnocksSignal.value).toEqual([]);
    });
    expect(container.textContent).toBe('');
  });

  it('Deny kicks the knock away with a reason', async () => {
    pendingKnocksSignal.value = [ANN];
    const ui = makeUi();
    const { getByRole } = render(h(KnockRequests, { ui }));
    fireEvent.click(getByRole('button', { name: /deny/i }));
    await waitFor(() => {
      expect(ui.widgetManager.kickUser).toHaveBeenCalledWith('@ann:hs', expect.any(String));
      expect(pendingKnocksSignal.value).toEqual([]);
    });
  });

  it('a failed approve keeps the row and surfaces a toast', async () => {
    pendingKnocksSignal.value = [ANN];
    const ui = makeUi({ inviteUser: vi.fn(async () => { throw new Error('M_FORBIDDEN'); }) });
    const { getByRole } = render(h(KnockRequests, { ui }));
    fireEvent.click(getByRole('button', { name: /approve/i }));
    await waitFor(() => {
      expect(ui._toast).toHaveBeenCalled();
    });
    expect(pendingKnocksSignal.value).toHaveLength(1);
  });
});
