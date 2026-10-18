/**
 * render-policy decides one thing on first render: wizard, or not. The
 * old else-branch stacked a spotlight tour and a welcome modal - two
 * focus-stealing overlays the file itself carried a patch comment
 * about. The checklist renders from the shell and needs no branch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../ui/App.jsx', () => ({ mountApp: vi.fn() }));
vi.mock('../utils/room-snapshot-probe.js', () => ({
  probeRoomSnapshotState: vi.fn().mockResolvedValue('absent'),
}));

const { renderUI } = await import('../ui/render-policy.js');

function makeUi({ hasMap = false, forceWizard = false } = {}) {
  return /** @type {any} */ ({
    state: { map: hasMap ? { id: 'm' } : null, tokens: new Map(), characters: new Map(),
      npcs: new Map(), items: new Map(), spells: new Map(), handouts: new Map(),
      tables: new Map(), maps: new Map(), walls: new Map(), templates: new Map(),
      pins: new Map(), lights: new Map(), pages: new Map(), drawings: [] },
    widgetManager: { userId: '@u:hs', roomId: '!r:hs', getApi: () => null },
    _forceWizard: forceWizard,
    restoreTheme: vi.fn(),
    _syncDisplayName: vi.fn(),
    showFirstTimeSetup: vi.fn(),
  });
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('renderUI first-render decision', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('opens a room with no campaign straight to chat', async () => {
    const ui = makeUi();
    renderUI(ui);
    await flush();
    expect(ui.showFirstTimeSetup).not.toHaveBeenCalled();
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('opens the wizard for a room the user just created', async () => {
    const ui = makeUi({ forceWizard: true });
    renderUI(ui);
    await flush();
    expect(ui.showFirstTimeSetup).toHaveBeenCalled();
  });

  it('opens no overlay at all for a room that already has one', async () => {
    const ui = makeUi({ hasMap: true });
    renderUI(ui);
    await flush();
    expect(ui.showFirstTimeSetup).not.toHaveBeenCalled();
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });
});
