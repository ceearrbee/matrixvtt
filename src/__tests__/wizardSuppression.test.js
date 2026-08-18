/**
 * Regression: a page reload of a seeded room must NOT re-fire the
 * setup wizard. Before this fix, the wizard was triggered whenever
 * `sm.maps` was empty at render time, regardless of whether the room
 * itself had a published Yjs snapshot - and the snapshot-bridge race
 * meant sm.maps was reliably empty for the first frame after reload.
 *
 * The render-policy fix adds a server-state probe: if the room has a
 * snapshot event the user must NOT see the wizard, even when local
 * state hasn't yet hydrated.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let renderUI;
let mockMountApp;

vi.mock('../ui/App.jsx', () => {
  mockMountApp = vi.fn();
  return { mountApp: (...args) => mockMountApp(...args) };
});
vi.mock('../ui/setup-tombstone.js', () => ({
  _countResidualEntities: () => 0,
}));
// The welcome branch auto-starts the driver.js tour, whose async DOM
// teardown collides with happy-dom body resets between tests.
vi.mock('../ui/onboarding-tour.js', () => ({ maybeAutoStartTour: vi.fn() }));
import { maybeAutoStartTour } from '../ui/onboarding-tour.js';

beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = '<div id="app"></div>';
  ({ renderUI } = await import('../ui/render-policy.js'));
});

afterEach(() => { document.body.innerHTML = ''; });

function makeUi({ snapshotEvents, forceWizard = false, mapValue = null } = {}) {
  const receiveStateEvents = vi.fn(async (type) => {
    if (type === 'com.matrixvtt.yjs.snapshot') return snapshotEvents ?? [];
    return [];
  });
  return {
    state: { map: mapValue },
    widgetManager: { getApi: () => ({ receiveStateEvents }) },
    restoreTheme: vi.fn(),
    _syncDisplayName: vi.fn(),
    _welcomeShown: false,
    _forceWizard: forceWizard,
    showFirstTimeSetup: vi.fn(),
    showPlayerWelcome: vi.fn(),
    isTutorialCompleted: () => true,
    startTutorial: vi.fn(),
    _receiveStateEvents: receiveStateEvents,
  };
}

function tick() {
  // requestAnimationFrame + a microtask flush so the async rAF body runs.
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      Promise.resolve().then(() => Promise.resolve()).then(resolve);
    });
  });
}

describe('renderUI - wizard suppression', () => {
  it('shows the wizard on a genuine empty room (no snapshot, no maps)', async () => {
    const ui = makeUi({ snapshotEvents: [] });
    renderUI(ui);
    await tick();
    expect(ui.showFirstTimeSetup).toHaveBeenCalled();
    expect(ui.showPlayerWelcome).not.toHaveBeenCalled();
  });

  it('SUPPRESSES the wizard on reload when the room has a snapshot', async () => {
    const ui = makeUi({
      snapshotEvents: [{ content: { data: 'b64', marker: 42 } }],
    });
    renderUI(ui);
    await tick();
    expect(ui.showFirstTimeSetup).not.toHaveBeenCalled();
    expect(maybeAutoStartTour).toHaveBeenCalled();
  });

  it('SUPPRESSES the wizard even when forceWizard=true if a snapshot exists', async () => {
    const ui = makeUi({
      snapshotEvents: [{ content: { data: 'b64', marker: 1 } }],
      forceWizard: true,
    });
    renderUI(ui);
    await tick();
    expect(ui.showFirstTimeSetup).not.toHaveBeenCalled();
  });

  it('still shows the wizard when forceWizard=true and no snapshot exists', async () => {
    const ui = makeUi({ snapshotEvents: [], forceWizard: true });
    renderUI(ui);
    await tick();
    expect(ui.showFirstTimeSetup).toHaveBeenCalled();
  });

  it('does NOT probe the server when local state is healthy', async () => {
    const ui = makeUi({
      snapshotEvents: [{ content: { data: 'b64', marker: 1 } }],
      mapValue: { id: 'm1', width_cells: 10 },
    });
    renderUI(ui);
    await tick();
    expect(ui.showFirstTimeSetup).not.toHaveBeenCalled();
    expect(ui._receiveStateEvents).not.toHaveBeenCalled();
  });
});
