/**
 * The token-placement chooser: which of the campaign's tokens to put on
 * the map you are looking at.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent } from '@testing-library/preact';
import { showBringTokensModal } from '../ui/BringTokensModal.jsx';
import { closeAllOpenModals } from '../ui/modal-host.js';
import { ENTITY_TYPES } from '../utils/constants.js';

const tok = (id, name, type, mapId) => [id, { id, name, type, map_id: mapId, col: 1, row: 1 }];

function makeUi(extra = []) {
  return {
    _toast: vi.fn(),
    mapRenderer: { render: vi.fn() },
    state: {
      activeMapId: 'map-b',
      isGM: () => true,
      maps: new Map([['map-b', { id: 'map-b', width_cells: 10, height_cells: 10 }]]),
      tokens: new Map([
        tok('kael', 'Kael', ENTITY_TYPES.PC, 'map-a'),
        tok('sora', 'Sora', ENTITY_TYPES.PC, 'map-a'),
        tok('orc', 'Orc Guard', ENTITY_TYPES.NPC, 'map-a'),
        tok('dragon', 'Ancient Red', ENTITY_TYPES.NPC, 'map-b'),
        ...extra,
      ]),
      updateToken: vi.fn().mockResolvedValue(undefined),
    },
  };
}

function flush() { return new Promise((r) => setTimeout(r, 20)); }
const rows = () => [...document.querySelectorAll('[data-bring-token]')];
const byText = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t));

afterEach(() => closeAllOpenModals());

describe('showBringTokensModal', () => {
  it('lists only tokens that are not already here', async () => {
    showBringTokensModal({ ui: makeUi(), col: 5, row: 5 });
    await flush();
    expect(rows().map((r) => r.dataset.bringToken).sort()).toEqual(['kael', 'orc', 'sora']);
  });

  it('separates the party from everyone else', async () => {
    showBringTokensModal({ ui: makeUi(), col: 5, row: 5 });
    await flush();
    const headings = [...document.querySelectorAll('.bring-tokens__group-label')].map((n) => n.textContent);
    expect(headings).toEqual(['Player characters', 'NPCs and monsters']);
  });

  it('says so plainly when every token is already on this map', async () => {
    const ui = makeUi();
    ui.state.tokens = new Map([tok('dragon', 'Ancient Red', ENTITY_TYPES.NPC, 'map-b')]);
    showBringTokensModal({ ui, col: 5, row: 5 });
    await flush();
    expect(rows()).toEqual([]);
    expect(document.querySelector('.bring-tokens__empty')).toBeTruthy();
  });

  it('places the checked tokens at the chosen cell and closes', async () => {
    const ui = makeUi();
    showBringTokensModal({ ui, col: 5, row: 5 });
    await flush();
    fireEvent.click(document.querySelector('[data-bring-token="kael"] input'));
    fireEvent.click(document.querySelector('[data-bring-token="orc"] input'));
    fireEvent.click(byText('Place'));
    await flush();
    expect(ui.state.updateToken).toHaveBeenCalledTimes(2);
    expect(ui._toast).toHaveBeenCalledWith(expect.stringContaining('2'), 'success');
    expect(document.querySelector('[data-bring-token]')).toBeNull();
  });

  it('will not place nothing', async () => {
    const ui = makeUi();
    showBringTokensModal({ ui, col: 5, row: 5 });
    await flush();
    expect(byText('Place').disabled).toBe(true);
  });

  it('offers a way to take the whole party at once', async () => {
    const ui = makeUi();
    showBringTokensModal({ ui, col: 5, row: 5 });
    await flush();
    fireEvent.click(byText('Select the party'));
    await flush();
    fireEvent.click(byText('Place'));
    await flush();
    const moved = ui.state.updateToken.mock.calls.map(([id]) => id).sort();
    expect(moved).toEqual(['kael', 'sora']);
  });

  it('counts what it is about to do', async () => {
    showBringTokensModal({ ui: makeUi(), col: 5, row: 5 });
    await flush();
    fireEvent.click(document.querySelector('[data-bring-token="kael"] input'));
    await flush();
    expect(byText('Place').textContent).toMatch(/1/);
  });

  it('surfaces a failure rather than closing on it', async () => {
    const ui = makeUi();
    ui.state.updateToken = vi.fn().mockRejectedValue(new Error('rate limited'));
    showBringTokensModal({ ui, col: 5, row: 5 });
    await flush();
    fireEvent.click(document.querySelector('[data-bring-token="kael"] input'));
    fireEvent.click(byText('Place'));
    await flush();
    expect(ui._toast).toHaveBeenCalledWith(expect.stringContaining('rate limited'), 'error');
  });
});
