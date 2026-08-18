/**
 * Fog operation rollback on send failure (gm-ops.js → gm/fog-ops.js).
 *
 * toggleFog / revealAllFog / hideAllFog must:
 *  - revert local state when sendStateEvent throws
 *  - show an error notification on failure
 *
 * Canvas rerender on success is handled by MapRenderer's fogSignal
 * effect, not by these helpers - so the old "calls render" assertions
 * are gone.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// revealAllFog / hideAllFog gate their write behind a destructive-action
// confirm dialog. Tests need the callback to actually fire - auto-accept
// the confirm so the underlying _writeFog still runs.
vi.mock('../ui/confirm-dialogs.jsx', () => ({
  confirm: (_msg, onConfirm) => onConfirm(),
  confirmAsync: (_msg, onConfirm) => onConfirm(),
  confirmTyped: (_msg, _phrase, onConfirm) => onConfirm(),
}));

import { toggleFog, revealAllFog, hideAllFog } from '../ui/gm-ops.js';
import * as errorHandling from '../utils/errorHandling.js';
import { withFacade } from './helpers/withFacade.js';

function makeUi(sendFn, fogState = null) {
  const fog = fogState ?? { mode: 'visible', revealed: [] };
  return {
    state: withFacade({
      isGM: () => true,
      fog,
      cancelDebouncedSend: vi.fn(),
      sendStateEvent: sendFn,
      map: { width_cells: 2, height_cells: 2 },
    }),
    mapRenderer: { render: vi.fn() },
    _toast: vi.fn(),
  };
}

describe('toggleFog', () => {
  it('reverts fog.mode when sendStateEvent throws', async () => {
    const ui = makeUi(vi.fn().mockRejectedValue(new Error('network')));
    ui.state.fog.mode = 'visible';

    await toggleFog(ui);

    expect(ui.state.fog.mode).toBe('visible'); // reverted
  });

  it('shows error notification when sendStateEvent throws', async () => {
    const spy = vi.spyOn(errorHandling, 'showErrorNotification').mockReturnValue(undefined);
    const ui = makeUi(vi.fn().mockRejectedValue(new Error('network')));

    await toggleFog(ui);

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

});

describe('revealAllFog', () => {
  it('reverts fog to previous value when sendStateEvent throws', async () => {
    const previousFog = { mode: 'hidden', revealed: ['0,0'] };
    const ui = makeUi(vi.fn().mockRejectedValue(new Error('network')), { ...previousFog });

    await revealAllFog(ui);

    expect(ui.state.fog).toEqual(previousFog);
  });

  it('shows error notification on failure', async () => {
    const spy = vi.spyOn(errorHandling, 'showErrorNotification').mockReturnValue(undefined);
    const ui = makeUi(vi.fn().mockRejectedValue(new Error('x')));

    await revealAllFog(ui);

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

});

describe('hideAllFog', () => {
  it('reverts fog to previous value when sendStateEvent throws', async () => {
    const previousFog = { mode: 'hidden', revealed: ['1,1', '0,0'] };
    const ui = makeUi(vi.fn().mockRejectedValue(new Error('network')), { ...previousFog, revealed: [...previousFog.revealed] });

    await hideAllFog(ui);

    expect(ui.state.fog).toEqual(previousFog);
  });

  it('shows error notification on failure', async () => {
    const spy = vi.spyOn(errorHandling, 'showErrorNotification').mockReturnValue(undefined);
    const ui = makeUi(vi.fn().mockRejectedValue(new Error('x')));

    await hideAllFog(ui);

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
