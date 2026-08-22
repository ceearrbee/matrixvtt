/**
 * The invite modal is link-first: one MatrixVTT player link anyone can
 * open, a paste-ready share message, an honest access line, and the
 * one-click switch that turns an invite-only room into a room where the
 * link alone is enough.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showInvitePlayerModal } from '../ui/InvitePlayerModal.jsx';

function makeUI(joinRule, overrides = {}) {
  return /** @type {any} */ ({
    state: { settings: { name: 'Curse of Strahd' } },
    _toast: vi.fn(),
    widgetManager: {
      roomId: '!room:hs.example',
      getRoomState: joinRule instanceof Error
        ? vi.fn().mockRejectedValue(joinRule)
        : vi.fn().mockResolvedValue([{ type: 'm.room.join_rules', content: { join_rule: joinRule } }]),
      inviteUser: vi.fn().mockResolvedValue({}),
      setJoinRule: vi.fn().mockResolvedValue({}),
      ...overrides,
    },
  });
}

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => {
  document.querySelectorAll('.modal-overlay').forEach((n) => n.remove());
});

const text = () => document.body.textContent;
const $ = (sel) => /** @type {any} */ (document.querySelector(sel));

describe('player link', () => {
  it('shows a MatrixVTT link players can open directly, and copies it', async () => {
    const ui = makeUI('knock');
    showInvitePlayerModal(ui);
    await vi.waitFor(() => expect($('#invite-player-link')).not.toBeNull());
    const value = $('#invite-player-link').value;
    expect(value).toContain('app.html?join=%21room%3Ahs.example');
    expect(value).toContain('via=hs.example');
    expect($('#invite-player-link').readOnly).toBe(true);

    $('#copy-player-link-btn').click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(value));
  });

  it('copies a share message naming the session', async () => {
    showInvitePlayerModal(makeUI('knock'));
    await vi.waitFor(() => expect($('#copy-invite-message-btn')).not.toBeNull());
    $('#copy-invite-message-btn').click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    const msg = writeText.mock.calls[0][0];
    expect(msg).toContain('Curse of Strahd');
    expect(msg).toContain('app.html?join=');
  });

  it('keeps the matrix.to link available for Matrix clients', async () => {
    showInvitePlayerModal(makeUI('knock'));
    await vi.waitFor(() => expect($('#invite-matrix-to-link')).not.toBeNull());
    expect($('#invite-matrix-to-link').value).toBe('https://matrix.to/#/!room%3Ahs.example?via=hs.example');
    $('#copy-matrix-link-btn').click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith($('#invite-matrix-to-link').value));
  });
});

describe('access state', () => {
  it('says the link is enough on a knockable room, with no switch offered', async () => {
    showInvitePlayerModal(makeUI('knock'));
    await vi.waitFor(() => expect(text()).toMatch(/ask to join/i));
    expect($('#allow-knock-btn')).toBeNull();
    expect(text()).toMatch(/approve/i);
  });

  it('offers the one-click switch on an invite-only room', async () => {
    const ui = makeUI('invite');
    showInvitePlayerModal(ui);
    await vi.waitFor(() => expect(text()).toMatch(/only players you invite/i));
    expect($('#allow-knock-btn')).not.toBeNull();

    $('#allow-knock-btn').click();
    await vi.waitFor(() => expect(ui.widgetManager.setJoinRule).toHaveBeenCalledWith('knock'));
    await vi.waitFor(() => expect($('#allow-knock-btn')).toBeNull());
    expect(text()).toMatch(/ask to join/i);
    expect(ui._toast).toHaveBeenCalled();
  });

  it('surfaces a failed switch without changing the stated access', async () => {
    const ui = makeUI('invite', { setJoinRule: vi.fn().mockRejectedValue(new Error('nope')) });
    showInvitePlayerModal(ui);
    await vi.waitFor(() => expect(text()).toMatch(/only players you invite/i));
    $('#allow-knock-btn').click();
    await vi.waitFor(() => expect(document.querySelector('.auth-error')?.textContent).toMatch(/nope/));
    expect($('#allow-knock-btn')).not.toBeNull();
    expect(text()).toMatch(/only players you invite/i);
  });

  it('is honest when the join rule cannot be read', async () => {
    showInvitePlayerModal(makeUI(new Error('403')));
    await vi.waitFor(() => expect(text()).toMatch(/could not read/i));
    expect($('#allow-knock-btn')).not.toBeNull();
  });
});

describe('Matrix ID invite', () => {
  it('still invites a specific user', async () => {
    const ui = makeUI('invite');
    showInvitePlayerModal(ui);
    await vi.waitFor(() => expect($('#invite-user-id')).not.toBeNull());
    $('#invite-user-id').value = '@mox:mozilla.org';
    $('#invite-user-id').dispatchEvent(new Event('input', { bubbles: true }));
    $('#send-invite-btn').click();
    await vi.waitFor(() => expect(ui.widgetManager.inviteUser).toHaveBeenCalledWith('@mox:mozilla.org'));
  });

  it('rejects a malformed Matrix ID before sending', async () => {
    const ui = makeUI('invite');
    showInvitePlayerModal(ui);
    await vi.waitFor(() => expect($('#invite-user-id')).not.toBeNull());
    $('#invite-user-id').value = 'mox';
    $('#send-invite-btn').click();
    await vi.waitFor(() => expect(document.querySelector('.auth-error')?.textContent).toMatch(/@name:matrix\.org/));
    expect(ui.widgetManager.inviteUser).not.toHaveBeenCalled();
  });
});
