/**
 * The debug bar must mount when _debugMode flips true and the app
 * re-renders (the global-menu "Toggle debug bar" path calls
 * ui.render()). Reproduces the "debug bar not working" report.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h } from 'preact';

vi.mock('../ui/useKeyboardShortcuts.js', () => ({ useKeyboardShortcuts: () => {} }));
vi.mock('../ui/Header.jsx', () => ({ Header: () => h('div', { 'data-stub': 'header' }) }));
vi.mock('../ui/DiceBar.jsx', () => ({ DiceBar: () => null }));
vi.mock('../ui/RightCompanion.jsx', () => ({ RightCompanion: () => null }));
vi.mock('../ui/LeftIndex.jsx', () => ({ LeftIndex: () => null }));
vi.mock('../ui/IconRail.jsx', () => ({ IconRail: () => null }));
vi.mock('../ui/SuggestedModeBanner.jsx', () => ({ SuggestedModeBanner: () => null }));
vi.mock('../ui/MapStrip.jsx', () => ({ MapStrip: () => null }));
vi.mock('../ui/LogContainer.jsx', () => ({ LogContainer: () => null }));
vi.mock('../ui/CombatInitiativeStrip.jsx', () => ({ CombatInitiativeStrip: () => null }));
vi.mock('../ui/InitiativeBar.jsx', () => ({ InitiativeBar: () => null }));
vi.mock('../ui/MobileTabBar.jsx', () => ({ MobileTabBar: () => null }));
vi.mock('../ui/FloatingDoc.jsx', () => ({ FloatingDocs: () => null }));
vi.mock('../ui/LegacyChatPopups.jsx', () => ({ LegacyChatPopups: () => null }));
vi.mock('../ui/sync/SyncProgress.jsx', () => ({ SyncProgress: () => null }));

const { mountApp } = await import('../ui/App.jsx');
const { debugModeSignal } = await import('../state/ui-signals.js');

function makeUi() {
  return /** @type {any} */ ({
    state: {
      isGM: () => true,
      tokens: new Map(),
      settings: { name: 'r', systemConfig: {}, gm_user_ids: ['@me:m'] },
      initiative: { active: false, round: 0, current_index: 0, order: [] },
      fog: { mode: null, revealed: [] },
      activeMapId: null,
    },
    widgetManager: { userId: '@me:m', roomId: '!r:m', homeserver: 'hs', accessToken: 'tok' },
  });
}

describe('debug bar mount', () => {
  let host;
  beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); debugModeSignal.value = false; });
  afterEach(() => { host.remove(); debugModeSignal.value = false; });

  it('does not render the bar when the signal is off', () => {
    mountApp(host, makeUi());
    expect(host.querySelector('.debug-bar')).toBeNull();
  });

  it('renders the bar when the signal is on', () => {
    debugModeSignal.value = true;
    mountApp(host, makeUi());
    expect(host.querySelector('.debug-bar')).not.toBeNull();
  });

  it('mounts the bar reactively when the signal flips after mount (the toggle path)', async () => {
    mountApp(host, makeUi());
    expect(host.querySelector('.debug-bar')).toBeNull();
    // No second mountApp: flipping the signal must re-render the App on
    // its own, which is what the global-menu toggle relies on. Preact
    // signals schedule the re-render, so await a tick.
    debugModeSignal.value = true;
    await new Promise((r) => setTimeout(r, 0));
    expect(host.querySelector('.debug-bar')).not.toBeNull();
  });
});
