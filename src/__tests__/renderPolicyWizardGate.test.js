/**
 * render-policy wizard gate.
 *
 * Bug: a room with live VTT content (tokens, characters, items, etc.)
 * showed the first-time-setup wizard on every reload because the
 * gate read `showWizard = noMap || (forceWizard && residual === 0)`.
 * The `noMap` branch fired regardless of residual count, so a fresh
 * reload where `ui.state.map` hadn't been populated yet (or a room
 * that never had an active map but had every other kind of entity)
 * always triggered the wizard.
 *
 * Correct gate: only show the wizard when the room reads as fresh
 * (noMap or forceWizard) AND there are zero residual entities.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// mountApp pulls in the full Preact UI tree (App.jsx) which needs a
// real UIController. The wizard-gate decision is pure logic and
// doesn't need a mounted app - mock mountApp out.
vi.mock('../ui/App.jsx', () => ({ mountApp: vi.fn() }));
vi.mock('../ui/onboarding-tour.js', () => ({ maybeAutoStartTour: vi.fn() }));

import { renderUI } from '../ui/render-policy.js';
import { maybeAutoStartTour } from '../ui/onboarding-tour.js';

function makeUi({ map = null, tokens = new Map(), forceWizard = false } = {}) {
  const ui = {
    state: {
      map,
      tokens,
      characters: new Map(),
      npcs: new Map(),
      items: new Map(),
      spells: new Map(),
      handouts: new Map(),
      tables: new Map(),
      walls: new Map(),
      templates: new Map(),
      pins: new Map(),
      drawings: [],
    },
    _forceWizard: forceWizard,
    _welcomeShown: false,
    restoreTheme: vi.fn(),
    _syncDisplayName: vi.fn(),
    showFirstTimeSetup: vi.fn(),
    showPlayerWelcome: vi.fn(),
  };
  return ui;
}

async function flushRaf() {
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => setTimeout(r, 0));
}

describe('renderUI - wizard gate', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    maybeAutoStartTour.mockClear();
  });

  it('truly empty room (no map, no entities): show the wizard', async () => {
    const ui = makeUi();
    renderUI(ui);
    await flushRaf();
    expect(ui.showFirstTimeSetup).toHaveBeenCalled();
    expect(ui.showPlayerWelcome).not.toHaveBeenCalled();
  });

  it('forceWizard (just created the room) beats a racing visited stamp', async () => {
    const { stampRoomVisited, clearRoomVisited } = await import('../utils/room-visited.js');
    stampRoomVisited('@gm:hs', '!fresh:hs');
    try {
      const ui = makeUi({ forceWizard: true });
      ui.widgetManager = { userId: '@gm:hs', roomId: '!fresh:hs' };
      renderUI(ui);
      await flushRaf();
      expect(ui.showFirstTimeSetup).toHaveBeenCalled();
    } finally {
      clearRoomVisited('@gm:hs', '!fresh:hs');
    }
  });

  it('room has tokens but ui.state.map is empty: DO NOT show the wizard', async () => {
    const tokens = new Map([['t1', { id: 't1', name: 'Hero' }]]);
    const ui = makeUi({ tokens, map: null });
    renderUI(ui);
    await flushRaf();
    expect(ui.showFirstTimeSetup).not.toHaveBeenCalled();
    expect(maybeAutoStartTour).toHaveBeenCalled();
  });

  it('welcome waits for the tour: routed through onAfterTour, never stacked', async () => {
    const tokens = new Map([['t1', { id: 't1', name: 'Hero' }]]);
    const ui = makeUi({ tokens, map: null });
    renderUI(ui);
    await flushRaf();

    // The welcome must not open on its own while the tour spotlight is
    // painting - it opens through the tour's onAfterTour continuation.
    expect(ui.showPlayerWelcome).not.toHaveBeenCalled();
    expect(maybeAutoStartTour).toHaveBeenCalled();
    const opts = maybeAutoStartTour.mock.calls[0][0];
    expect(opts.onAfterTour).toBeTypeOf('function');
    opts.onAfterTour();
    expect(ui.showPlayerWelcome).toHaveBeenCalledOnce();
  });

  it('room has items but ui.state.map is empty: DO NOT show the wizard', async () => {
    const items = new Map();
    for (let i = 0; i < 79; i++) items.set(`i${i}`, { id: `i${i}`, name: `Item ${i}` });
    const ui = makeUi({ map: null });
    ui.state.items = items;
    renderUI(ui);
    await flushRaf();
    expect(ui.showFirstTimeSetup).not.toHaveBeenCalled();
    expect(maybeAutoStartTour).toHaveBeenCalled();
  });

  it('forceWizard=true + residual=0: show the wizard', async () => {
    const ui = makeUi({ map: { foo: 1 }, forceWizard: true });
    renderUI(ui);
    await flushRaf();
    expect(ui.showFirstTimeSetup).toHaveBeenCalled();
  });

  it('forceWizard=true + residual>0: DO NOT show the wizard', async () => {
    const tokens = new Map([['t1', { id: 't1', name: 'Hero' }]]);
    const ui = makeUi({ map: { foo: 1 }, tokens, forceWizard: true });
    renderUI(ui);
    await flushRaf();
    expect(ui.showFirstTimeSetup).not.toHaveBeenCalled();
    expect(maybeAutoStartTour).toHaveBeenCalled();
  });

  it('welcome branch auto-starts the onboarding tour with the ui context', async () => {
    const tokens = new Map([['t1', { id: 't1', name: 'Hero' }]]);
    const ui = makeUi({ tokens, map: null });
    renderUI(ui);
    await flushRaf();
    expect(maybeAutoStartTour).toHaveBeenCalledWith(
      expect.objectContaining({ ui, onAfterTour: expect.any(Function) }),
    );
  });

  it('wizard branch does NOT auto-start the tour', async () => {
    const ui = makeUi();
    renderUI(ui);
    await flushRaf();
    expect(ui.showFirstTimeSetup).toHaveBeenCalled();
    expect(maybeAutoStartTour).not.toHaveBeenCalled();
  });
});
