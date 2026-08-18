/**
 * Element answers roomIds-scoped state reads it will not serve with an
 * empty list, not an error. Treating "no events" as success meant the
 * implicit-room fallback never ran: the power level silently resolved
 * to 0 and the room creator sat at "Waiting for GM" with nothing in
 * the diagnostics log.
 */
import { describe, it, expect, vi } from 'vitest';
import { getUserPowerLevel, setRoomPowerLevels } from '../widget/room-adapter.js';

function makeWm(receiveStateEvents) {
  return /** @type {any} */ ({
    widgetApi: {
      receiveStateEvents: vi.fn(receiveStateEvents),
      sendStateEvent: vi.fn().mockResolvedValue({}),
    },
    sendStateEvent: vi.fn().mockResolvedValue({}),
    isStandalone: false,
    userId: '@crb:mozilla.org',
    roomId: '!room:mozilla.org',
    _roomIdsSupported: null,
    _canEditCache: { value: null, expiry: 0 },
  });
}

const PL_EVENT = [{ content: { users: { '@crb:mozilla.org': 100 }, users_default: 0 } }];

describe('getUserPowerLevel scoped-read fallback', () => {
  it('falls back to the implicit-room read when the scoped read returns no events', async () => {
    const wm = makeWm(async (_type, opts = {}) => (opts.roomIds ? [] : PL_EVENT));
    expect(await getUserPowerLevel(wm)).toBe(100);
  });

  it('still resolves through the scoped read when it returns events', async () => {
    const wm = makeWm(async () => PL_EVENT);
    expect(await getUserPowerLevel(wm)).toBe(100);
  });
});

describe('setRoomPowerLevels empty-read guard', () => {
  it('refuses to write power levels computed from an empty read', async () => {
    const wm = makeWm(async () => []);

    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await setRoomPowerLevels(wm, ['@crb:mozilla.org']);

    // Writing power levels derived from {} would drop every existing
    // user entry, including the creator's 100.
    expect(wm.sendStateEvent).not.toHaveBeenCalled();
    expect(errors).toHaveLength(1);
  });

  it('writes when a read succeeds, preserving existing user levels', async () => {
    const wm = makeWm(async (_type, opts = {}) => (opts.roomIds ? [] : PL_EVENT));

    await setRoomPowerLevels(wm, ['@gm:example.org']);

    expect(wm.sendStateEvent).toHaveBeenCalledTimes(1);
    const [, , content] = wm.sendStateEvent.mock.calls[0];
    expect(content.users['@crb:mozilla.org']).toBe(100);
    expect(content.users['@gm:example.org']).toBe(50);
  });
});

describe('WaitingForGM diagnostic line', () => {
  it('shows who and where the app thinks it is, and the measured power level', async () => {
    const { showWaitingForGM } = await import('../ui/WelcomeModals.jsx');
    const ui = /** @type {any} */ ({ widgetManager: { isAppClient: false }, showFirstTimeSetup: () => {} });

    showWaitingForGM(ui, true, { userId: '@crb:mozilla.org', roomId: '!room:mozilla.org', level: 0 });

    const diag = document.querySelector('[data-waiting-diag]');
    expect(diag).toBeTruthy();
    expect(diag.textContent).toContain('@crb:mozilla.org');
    expect(diag.textContent).toContain('!room:mozilla.org');
    expect(diag.textContent).toContain('power level 0');
    document.body.innerHTML = '';
  });
});
