/**
 * Almanac mobile reconciliation (mount contract).
 *
 * The channels column mounts BOTH the desktop LeftIndex and the mobile
 * IconRail; CSS shows exactly one per viewport (media queries aren't
 * evaluated in happy-dom, so this verifies the mount side only). The sheet
 * column mounts the unified RightCompanion for the mobile Panel pane.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';

vi.mock('../ui/useKeyboardShortcuts.js', () => ({ useKeyboardShortcuts: () => {} }));
vi.mock('../ui/Header.jsx', () => ({ Header: () => h('div', { 'data-stub': 'header' }) }));
vi.mock('../ui/DiceBar.jsx', () => ({ DiceBar: () => h('div', { 'data-stub': 'dice' }) }));
vi.mock('../ui/RightCompanion.jsx', () => ({ RightCompanion: () => h('div', { class: 'right-companion' }) }));
vi.mock('../ui/LeftIndex.jsx', () => ({ LeftIndex: () => h('div', { class: 'left-index' }) }));
vi.mock('../ui/IconRail.jsx', () => ({ IconRail: () => h('div', { class: 'icon-rail-host' }) }));
vi.mock('../ui/SuggestedModeBanner.jsx', () => ({ SuggestedModeBanner: () => null }));
vi.mock('../ui/MapStrip.jsx', () => ({ MapStrip: () => h('div', { 'data-stub': 'map' }) }));
vi.mock('../ui/LogContainer.jsx', () => ({ LogContainer: () => h('div', { 'data-stub': 'log' }) }));
vi.mock('../ui/CombatInitiativeStrip.jsx', () => ({ CombatInitiativeStrip: () => h('div', { class: 'combat-init-strip' }) }));
vi.mock('../ui/InitiativeBar.jsx', () => ({ InitiativeBar: () => h('div', { class: 'initiative-panel' }) }));
vi.mock('../ui/MobileTabBar.jsx', () => ({ MobileTabBar: () => h('div', { 'data-stub': 'mobile-tabs' }) }));
vi.mock('../ui/sync/DebugBar.jsx', () => ({ DebugBar: () => h('div', { 'data-stub': 'debug' }) }));
vi.mock('../ui/FloatingDoc.jsx', () => ({ FloatingDocs: () => h('div', { 'data-stub': 'docs' }) }));
vi.mock('../ui/LegacyChatPopups.jsx', () => ({ LegacyChatPopups: () => null }));

const { App } = await import('../ui/App.jsx');
const { tablePhaseSignal } = await import('../state/ui-signals.js');
const { UI_MODES } = await import('../utils/constants.js');

function makeUi() {
  return /** @type {any} */ ({
    state: {
      isGM: () => false,
      tokens: new Map(),
      settings: { name: 'r', systemConfig: {} },
      initiative: { active: false, round: 0, current_index: 0, order: [] },
      fog: { mode: null, revealed: [] },
      isTokenVisibleToPlayer: () => true,
    },
    widgetManager: { userId: '@me:m', roomId: '!r:m', canLeave: false },
    _debugMode: false,
  });
}

describe('Almanac mobile reconciliation', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
  });
  afterEach(() => { render(null, host); host.remove(); });

  it('mounts both LeftIndex and IconRail in the channels column', () => {
    render(h(App, { ui: makeUi() }), host);
    const channels = host.querySelector('.shell__channels');
    expect(channels.querySelector('.left-index')).not.toBeNull();
    expect(channels.querySelector('.icon-rail-host')).not.toBeNull();
  });

  it('mounts the unified RightCompanion in the sheet column', () => {
    render(h(App, { ui: makeUi() }), host);
    const sheet = host.querySelector('.shell__sheet');
    expect(sheet.querySelector('.right-companion')).not.toBeNull();
  });
});
