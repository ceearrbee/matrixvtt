/**
 * The wizard's render gate must auto-resume when the room already has
 * live VTT entities, even if `_forceWizard` is set by a stale
 * /joined_rooms signal. Only show the wizard when there's nothing to
 * resume (no map AND no residual entities).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../ui/App.jsx', () => ({ mountApp: vi.fn() }));
// The welcome branch auto-starts the driver.js tour, whose async DOM
// teardown collides with happy-dom body resets between tests.
vi.mock('../ui/onboarding-tour.js', () => ({ maybeAutoStartTour: vi.fn() }));

import { renderUI } from '../ui/render-policy.js';
import { maybeAutoStartTour } from '../ui/onboarding-tour.js';

function makeUi({ map = null, force = false, tokens = 0 } = {}) {
  document.body.innerHTML = '<div id="app"></div>';
  return {
    state: {
      map,
      tokens: new Map(Array.from({ length: tokens }, (_, i) => [`t${i}`, { id: `t${i}` }])),
      characters: new Map(), npcs: new Map(), items: new Map(),
      handouts: new Map(), tables: new Map(),
    },
    _welcomeShown: false,
    _eventHandlersInstalled: false,
    _forceWizard: force,
    _debugMode: false,
    restoreTheme: vi.fn(),
    initMapRenderer: vi.fn(),
    _syncDisplayName: vi.fn(),
    setupEventHandlers: vi.fn(),
    showFirstTimeSetup: vi.fn(),
    showPlayerWelcome: vi.fn(),
    isTutorialCompleted: () => true,
    startTutorial: vi.fn(),
  };
}

function flushRAF() {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

describe('renderUI wizard gate', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('shows the wizard when there is no map and no entities', async () => {
    const ui = makeUi({ map: null, force: false, tokens: 0 });
    renderUI(ui);
    await flushRAF();
    expect(ui.showFirstTimeSetup).toHaveBeenCalled();
    expect(ui.showPlayerWelcome).not.toHaveBeenCalled();
  });

  it('skips the wizard when entities exist, even if _forceWizard is set', async () => {
    const ui = makeUi({ map: { id: 'm1' }, force: true, tokens: 5 });
    renderUI(ui);
    await flushRAF();
    expect(ui.showFirstTimeSetup).not.toHaveBeenCalled();
    expect(maybeAutoStartTour).toHaveBeenCalled();
  });

  it('still shows the wizard when _forceWizard is set and the room is empty', async () => {
    const ui = makeUi({ map: { id: 'm1' }, force: true, tokens: 0 });
    renderUI(ui);
    await flushRAF();
    expect(ui.showFirstTimeSetup).toHaveBeenCalled();
  });

  it('skips the wizard for an established room with no force flag', async () => {
    const ui = makeUi({ map: { id: 'm1' }, force: false, tokens: 3 });
    renderUI(ui);
    await flushRAF();
    expect(ui.showFirstTimeSetup).not.toHaveBeenCalled();
    expect(maybeAutoStartTour).toHaveBeenCalled();
  });
});
