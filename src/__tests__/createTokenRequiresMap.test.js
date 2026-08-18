/**
 * createToken refuses to write a token without a map_id.
 *
 * Without an upfront guard, the token was being saved with map_id:null,
 * the schema rejected it silently, and the user saw a generic "Could
 * not save changes to Matrix" toast (or nothing) with no clue.
 */
import { describe, it, expect, vi } from 'vitest';
import { createToken } from '../ui/tokens-panel.js';

function makeUi({ activeMapId = null } = {}) {
  return {
    state: {
      activeMapId,
      tokens: new Map(),
      isGM: () => true,
    },
    widgetManager: { userId: '@me:example.com', sendStateEvent: vi.fn() },
    updateMapPanel: vi.fn(),
    _toast: vi.fn(),
  };
}

describe('createToken - requires a map', () => {
  it('refuses upfront and toasts when neither data.map_id nor activeMapId is present', async () => {
    const ui = makeUi();
    const result = await createToken(ui, {
      name: 'Loose Token', type: 'pc',
      col: 0, row: 0, size: 1,
    });
    expect(result).toBe(null);
    expect(ui.widgetManager.sendStateEvent).not.toHaveBeenCalled();
    expect(ui._toast).toHaveBeenCalled();
    expect(ui._toast.mock.calls[0][0]).toMatch(/no active map/i);
  });

  it('proceeds when data.map_id is supplied', async () => {
    const ui = makeUi();
    // Provide map_id directly - should not refuse.
    await createToken(ui, {
      name: 'Mapped',
      type: 'pc',
      map_id: 'map-keep',
      col: 0, row: 0, size: 1,
    });
    expect(ui._toast).not.toHaveBeenCalled();
  });

  it('proceeds when ui.state.activeMapId resolves', async () => {
    const ui = makeUi({ activeMapId: 'map-keep' });
    await createToken(ui, { name: 'Mapped', type: 'pc', col: 0, row: 0, size: 1 });
    expect(ui._toast).not.toHaveBeenCalled();
  });
});
