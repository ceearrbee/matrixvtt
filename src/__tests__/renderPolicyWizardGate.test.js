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

import { renderUI } from '../ui/render-policy.js';

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
  });

  it('a room with no campaign opens straight to chat', async () => {
    const ui = makeUi();
    renderUI(ui);
    await flushRaf();
    expect(ui.showFirstTimeSetup).not.toHaveBeenCalled();
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('a room this user just created opens the wizard', async () => {
    const ui = makeUi({ forceWizard: true });
    renderUI(ui);
    await flushRaf();
    expect(ui.showFirstTimeSetup).toHaveBeenCalled();
  });

  it('room has tokens but ui.state.map is empty: DO NOT show the wizard', async () => {
    const tokens = new Map([['t1', { id: 't1', name: 'Hero' }]]);
    const ui = makeUi({ tokens, map: null });
    renderUI(ui);
    await flushRaf();
    expect(ui.showFirstTimeSetup).not.toHaveBeenCalled();
  });

  it('opens no overlay at all on the non-wizard branch', async () => {
    const tokens = new Map([['t1', { id: 't1', name: 'Hero' }]]);
    const ui = makeUi({ tokens, map: null });
    renderUI(ui);
    await flushRaf();
    expect(ui.showFirstTimeSetup).not.toHaveBeenCalled();
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('room has items but ui.state.map is empty: DO NOT show the wizard', async () => {
    const items = new Map();
    for (let i = 0; i < 79; i++) items.set(`i${i}`, { id: `i${i}`, name: `Item ${i}` });
    const ui = makeUi({ map: null });
    ui.state.items = items;
    renderUI(ui);
    await flushRaf();
    expect(ui.showFirstTimeSetup).not.toHaveBeenCalled();
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
  });

});
