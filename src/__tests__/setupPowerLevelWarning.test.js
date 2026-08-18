/**
 * The GM/player power-level split is what lets players write tokens
 * and characters. Its failure during setup was a logger.warn: players
 * joined and silently could not edit. It must retry once, surface a
 * toast naming the consequence, and leave a GM-visible retry flag.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensurePlayerPowerLevels } from '../ui/setup-persistence.js';
import { plSplitFailedSignal } from '../state/ui-signals.js';

const rateLimit = () => Object.assign(new Error('limited'), {
  errcode: 'M_LIMIT_EXCEEDED', data: { retry_after_ms: 10 },
});

function makeUi(setRoomPowerLevels) {
  return /** @type {any} */ ({
    widgetManager: { setRoomPowerLevels },
    _toast: vi.fn(),
  });
}

beforeEach(() => {
  plSplitFailedSignal.value = null;
});

describe('ensurePlayerPowerLevels', () => {
  it('retries a rate-limited write and succeeds quietly', async () => {
    const set = vi.fn().mockRejectedValueOnce(rateLimit()).mockResolvedValueOnce(undefined);
    const ui = makeUi(set);

    expect(await ensurePlayerPowerLevels(ui, ['@gm:hs'])).toBe(true);
    expect(set).toHaveBeenCalledTimes(2);
    expect(ui._toast).not.toHaveBeenCalled();
    expect(plSplitFailedSignal.value).toBeNull();
  });

  it('surfaces a failure with consequence copy and a retry flag', async () => {
    const set = vi.fn().mockRejectedValue(Object.assign(new Error('nope'), { status: 500 }));
    const ui = makeUi(set);

    expect(await ensurePlayerPowerLevels(ui, ['@gm:hs'])).toBe(false);
    expect(ui._toast).toHaveBeenCalledWith(expect.stringMatching(/players .*not be able to edit/i), 'warning');
    expect(plSplitFailedSignal.value).toEqual(['@gm:hs']);
  });

  it('a later successful retry clears the flag', async () => {
    plSplitFailedSignal.value = ['@gm:hs'];
    const ui = makeUi(vi.fn().mockResolvedValue(undefined));

    expect(await ensurePlayerPowerLevels(ui, ['@gm:hs'])).toBe(true);
    expect(plSplitFailedSignal.value).toBeNull();
  });

  it('no-ops when the manager has no power-level support', async () => {
    const ui = /** @type {any} */ ({ widgetManager: {}, _toast: vi.fn() });
    expect(await ensurePlayerPowerLevels(ui, [])).toBe(true);
  });
});

describe('PlSplitWarning banner', () => {
  it('renders with a working retry when the flag is set, hides otherwise', async () => {
    const { h, render } = await import('preact');
    const { PlSplitWarning } = await import('../ui/GMTab.jsx');
    const root = document.createElement('div');
    document.body.appendChild(root);
    const ui = makeUi(vi.fn().mockResolvedValue(undefined));

    plSplitFailedSignal.value = ['@gm:hs'];
    render(h(PlSplitWarning, { ui }), root);
    expect(root.textContent).toMatch(/not be able to edit/i);

    root.querySelector('button').click();
    await new Promise((r) => setTimeout(r, 20));
    expect(ui.widgetManager.setRoomPowerLevels).toHaveBeenCalledWith(['@gm:hs']);
    expect(plSplitFailedSignal.value).toBeNull();

    render(null, root);
    root.remove();
  });
});
