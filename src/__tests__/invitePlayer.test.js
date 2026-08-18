/**
 * Invite-a-player coverage: the pure helpers behind the invite modal,
 * the ClientManager / room-adapter transport methods (standalone uses
 * /invite via the SDK; widget mode writes the m.room.member state event
 * the same way kick/ban already do), and the GM-gated menu entry.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  isValidMatrixUserId,
  describeInviteError,
  buildInviteLink,
  canonicalAliasFrom,
  roomInviteLink,
} from '../ui/invite-player.js';
import { ClientManager } from '../client/ClientManager.js';
import { inviteUser as roomAdapterInvite } from '../widget/room-adapter.js';
import { buildGlobalMenuItems } from '../ui/global-menu-items.js';

describe('isValidMatrixUserId', () => {
  it('accepts @localpart:domain forms', () => {
    expect(isValidMatrixUserId('@mox:mozilla.org')).toBe(true);
    expect(isValidMatrixUserId('@a:server.example:8448')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isValidMatrixUserId('mox:mozilla.org')).toBe(false);
    expect(isValidMatrixUserId('@mox')).toBe(false);
    expect(isValidMatrixUserId('@:server')).toBe(false);
    expect(isValidMatrixUserId('')).toBe(false);
    expect(isValidMatrixUserId(null)).toBe(false);
  });
});

describe('describeInviteError', () => {
  it('translates the common errcodes', () => {
    expect(describeInviteError({ errcode: 'M_FORBIDDEN' })).toMatch(/permission/i);
    expect(describeInviteError({ errcode: 'M_LIMIT_EXCEEDED' })).toMatch(/rate limit/i);
    expect(describeInviteError({ errcode: 'M_NOT_FOUND' })).toMatch(/not.*found|no.*user/i);
  });

  it('falls back to the raw message', () => {
    expect(describeInviteError(new Error('boom'))).toContain('boom');
  });
});

describe('ClientManager.inviteUser', () => {
  it('delegates to sdk.invite with the active room', async () => {
    const invite = vi.fn().mockResolvedValue({});
    function FakeClient() {
      this.sdk = { invite };
    }
    const cm = new ClientManager({ matrixClientClass: /** @type {any} */ (FakeClient) });
    cm.setCredentials('https://hs.example', 'tok', '@gm:hs.example', '!room:hs.example');
    await cm.inviteUser('@mox:mozilla.org');
    expect(invite).toHaveBeenCalledWith('!room:hs.example', '@mox:mozilla.org');
  });
});

describe('room-adapter inviteUser (widget mode)', () => {
  it('writes an m.room.member invite state event, like kick/ban', async () => {
    const wm = { sendStateEvent: vi.fn().mockResolvedValue({}) };
    await roomAdapterInvite(wm, '@mox:mozilla.org');
    expect(wm.sendStateEvent).toHaveBeenCalledWith('m.room.member', '@mox:mozilla.org', {
      membership: 'invite',
    });
  });
});

describe('buildInviteLink', () => {
  it('builds an encoded matrix.to link for a room ID with via routing', () => {
    expect(buildInviteLink('!room:hs.example', ['hs.example']))
      .toBe('https://matrix.to/#/!room%3Ahs.example?via=hs.example');
  });

  it('builds an encoded matrix.to link for an alias (no via needed)', () => {
    expect(buildInviteLink('#camp:hs.example')).toBe('https://matrix.to/#/%23camp%3Ahs.example');
  });
});

describe('canonicalAliasFrom', () => {
  it('returns the canonical alias when the state event carries one', () => {
    const state = [
      { type: 'm.room.name', content: { name: 'Game' } },
      { type: 'm.room.canonical_alias', content: { alias: '#camp:hs.example' } },
    ];
    expect(canonicalAliasFrom(state)).toBe('#camp:hs.example');
  });

  it('returns null for missing or malformed aliases', () => {
    expect(canonicalAliasFrom([])).toBeNull();
    expect(canonicalAliasFrom(null)).toBeNull();
    expect(canonicalAliasFrom([{ type: 'm.room.canonical_alias', content: {} }])).toBeNull();
    expect(canonicalAliasFrom([{ type: 'm.room.canonical_alias', content: { alias: 42 } }])).toBeNull();
  });
});

describe('roomInviteLink', () => {
  it('prefers the canonical alias over the room ID', async () => {
    const manager = {
      roomId: '!room:hs.example',
      getRoomState: vi.fn().mockResolvedValue([
        { type: 'm.room.canonical_alias', content: { alias: '#camp:hs.example' } },
      ]),
    };
    expect(await roomInviteLink(manager)).toBe('https://matrix.to/#/%23camp%3Ahs.example');
  });

  it('falls back to the room ID with a via hint when no alias exists or state reads fail', async () => {
    // Bare room IDs are not resolvable; without ?via= the join 404s
    // for anyone whose homeserver is not already in the room.
    const noAlias = { roomId: '!room:hs.example', getRoomState: vi.fn().mockResolvedValue([]) };
    expect(await roomInviteLink(noAlias)).toBe('https://matrix.to/#/!room%3Ahs.example?via=hs.example');

    const failing = { roomId: '!room:hs.example', getRoomState: vi.fn().mockRejectedValue(new Error('403')) };
    expect(await roomInviteLink(failing)).toBe('https://matrix.to/#/!room%3Ahs.example?via=hs.example');
  });

  it('the modal is honest about invite-only rooms', async () => {
    const { showInvitePlayerModal } = await import('../ui/invite-player.js');
    const ui = /** @type {any} */ ({ widgetManager: { roomId: '!r:hs' }, _toast: vi.fn() });
    showInvitePlayerModal(ui);
    try {
      expect(document.body.textContent).toMatch(/invite-only/i);
      expect(document.body.textContent).toMatch(/invite .*first|first.* invite/i);
    } finally {
      document.querySelectorAll('.modal-overlay').forEach((n) => n.remove());
    }
  });

  it('returns null when no room ID is available', async () => {
    expect(await roomInviteLink({ roomId: null, getRoomState: vi.fn().mockResolvedValue([]) })).toBeNull();
  });
});

describe('global menu invite entry', () => {
  const ui = { openSettings() {}, toggleTheme() {}, openMapsPanel() {} };

  it('is present only for the GM', () => {
    expect(buildGlobalMenuItems(ui, { isGM: true, canLeave: false }).some((i) => i.key === 'invite')).toBe(true);
    expect(buildGlobalMenuItems(ui, { isGM: false, canLeave: false }).some((i) => i.key === 'invite')).toBe(false);
  });
});

describe('invite modal copy tracks the join rule', () => {
  const closeModals = () => document.querySelectorAll('.modal-overlay').forEach((n) => n.remove());

  it('joinRuleFrom reads m.room.join_rules out of the room state', async () => {
    const { joinRuleFrom } = await import('../ui/invite-player.js');
    expect(joinRuleFrom([{ type: 'm.room.join_rules', content: { join_rule: 'knock' } }])).toBe('knock');
    expect(joinRuleFrom([{ type: 'm.room.join_rules', content: { join_rule: 'invite' } }])).toBe('invite');
    expect(joinRuleFrom([])).toBeNull();
    expect(joinRuleFrom(null)).toBeNull();
  });

  it('promises the shared link works on knockable rooms', async () => {
    const { showInvitePlayerModal } = await import('../ui/invite-player.js');
    const ui = /** @type {any} */ ({
      widgetManager: {
        roomId: '!r:hs',
        getRoomState: vi.fn().mockResolvedValue([
          { type: 'm.room.join_rules', content: { join_rule: 'knock' } },
        ]),
      },
      _toast: vi.fn(),
    });
    showInvitePlayerModal(ui);
    try {
      await vi.waitFor(() => {
        expect(document.body.textContent).toMatch(/request to join|ask to join/i);
      });
      expect(document.body.textContent).not.toMatch(/invite-only/i);
    } finally {
      closeModals();
    }
  });

  it('keeps the honest invite-first copy when the join rule is unknown', async () => {
    const { showInvitePlayerModal } = await import('../ui/invite-player.js');
    const ui = /** @type {any} */ ({
      widgetManager: { roomId: '!r:hs', getRoomState: vi.fn().mockRejectedValue(new Error('403')) },
      _toast: vi.fn(),
    });
    showInvitePlayerModal(ui);
    try {
      await vi.waitFor(() => {
        expect(ui.widgetManager.getRoomState).toHaveBeenCalled();
      });
      expect(document.body.textContent).toMatch(/invite-only/i);
    } finally {
      closeModals();
    }
  });
});
