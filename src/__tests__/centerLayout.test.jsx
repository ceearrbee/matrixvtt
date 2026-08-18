/**
 * Almanac center column: map region (with the initiative strip overlaid on
 * the map) above a chronicle region whose last child is the composer.
 *
 * The Almanac overlays the initiative strip across the top of the map,
 * never below it as a sibling of the log. The composer (DiceBar)
 * docks at the bottom of the chronicle.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';

vi.mock('../ui/useKeyboardShortcuts.js', () => ({ useKeyboardShortcuts: () => {} }));
vi.mock('../ui/Header.jsx', () => ({ Header: () => h('div', { 'data-stub': 'header' }) }));
vi.mock('../ui/DiceBar.jsx', () => ({ DiceBar: () => h('div', { 'data-stub': 'dice' }) }));
vi.mock('../ui/RightCompanion.jsx', () => ({ RightCompanion: () => h('div', { 'data-stub': 'companion' }) }));
vi.mock('../ui/LeftIndex.jsx', () => ({ LeftIndex: () => h('div', { 'data-stub': 'left-index' }) }));
vi.mock('../ui/IconRail.jsx', () => ({ IconRail: () => h('div', { 'data-stub': 'icon-rail' }) }));
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
const { initiativeSignal } = await import('../state/signals.js');
const { UI_MODES } = await import('../utils/constants.js');

function makeUi({ isGM = false, combatActive = false } = {}) {
  return /** @type {any} */ ({
    state: {
      isGM: () => isGM,
      tokens: new Map(),
      settings: { name: 'r', systemConfig: {}, gm_user_ids: isGM ? ['@me:m'] : [] },
      initiative: combatActive
        ? { active: true, round: 1, current_index: 0, order: [] }
        : { active: false, round: 0, current_index: 0, order: [] },
      fog: { mode: null, revealed: [] },
      isTokenVisibleToPlayer: () => true,
    },
    widgetManager: { userId: '@me:m', roomId: '!r:m', canLeave: false },
    _debugMode: false,
  });
}

describe('Almanac center layout', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => { render(null, host); host.remove(); });

  it('mounts the map and the initiative strip inside the same map region', () => {
    tablePhaseSignal.value = UI_MODES.COMBAT;
    initiativeSignal.value = { active: true, round: 1, current_index: 0, order: [] };
    render(h(App, { ui: makeUi({ combatActive: true, isGM: true }) }), host);
    const mapRegion = host.querySelector('.almanac-map');
    expect(mapRegion).not.toBeNull();
    expect(mapRegion.querySelector('[data-stub="map"]')).not.toBeNull();
    expect(mapRegion.querySelector('.combat-init-strip')).not.toBeNull();
  });

  it('docks the composer as the last child of the chronicle, after the log', () => {
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
    render(h(App, { ui: makeUi({ isGM: true }) }), host);
    const chronicle = host.querySelector('.chronicle');
    expect(chronicle).not.toBeNull();
    expect(chronicle.querySelector('[data-stub="log"]')).not.toBeNull();
    expect(chronicle.lastElementChild.getAttribute('data-stub')).toBe('dice');
  });
});
