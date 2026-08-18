/**
 * App shell `data-ui-mode` attribute - JS-side contract.
 *
 * Asserts the attribute mirrors `tablePhaseSignal.value` on initial render
 * and re-renders when the signal changes. The CSS-side contract (what
 * the attribute selectors actually hide/show) lives in
 * `uiModeCss.test.js` so happy-dom's getComputedStyle isn't needed
 * here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup } from '@testing-library/preact';
import { tablePhaseSignal } from '../state/ui-signals.js';
import { UI_MODES } from '../utils/constants.js';

vi.mock('../ui/useKeyboardShortcuts.js', () => ({ useKeyboardShortcuts: () => {} }));
vi.mock('../ui/Header.jsx', () => ({ Header: () => h('div', { 'data-stub': 'header' }) }));
vi.mock('../ui/DiceBar.jsx', () => ({ DiceBar: () => h('div', { 'data-stub': 'dice' }) }));
vi.mock('../ui/RightCompanion.jsx', () => ({ RightCompanion: () => h('div', { 'data-stub': 'companion' }) }));
vi.mock('../ui/LeftIndex.jsx', () => ({ LeftIndex: () => h('div', { 'data-stub': 'left-index' }) }));
vi.mock('../ui/InitiativeBar.jsx', () => ({ InitiativeBar: () => h('div', { 'data-stub': 'init' }) }));
vi.mock('../ui/MapStrip.jsx', () => ({ MapStrip: () => h('div', { 'data-stub': 'map' }), TOOLS: [], GM_TOOLS: [] }));
vi.mock('../ui/LogContainer.jsx', () => ({ LogContainer: () => h('div', { 'data-stub': 'log' }) }));
vi.mock('../ui/ChannelsRail.jsx', () => ({ ChannelsRail: () => h('div', { 'data-stub': 'channels' }) }));
vi.mock('../ui/sync/DebugBar.jsx', () => ({ DebugBar: () => h('div', { 'data-stub': 'debug' }) }));
vi.mock('../ui/FloatingDoc.jsx', () => ({ FloatingDocs: () => h('div', { 'data-stub': 'docs' }) }));

const { App } = await import('../ui/App.jsx');

function mkUi() {
  return /** @type {any} */ ({
    state: {
      initiative: { active: false },
      isGM: () => true,
    },
    _debugMode: false,
    widgetManager: { userId: '@u:s', roomId: '!r:s' },
  });
}

beforeEach(() => { tablePhaseSignal.value = UI_MODES.NARRATIVE; });
afterEach(() => { cleanup(); tablePhaseSignal.value = UI_MODES.NARRATIVE; });

describe('shell data-ui-mode attribute', () => {
  it('mirrors tablePhaseSignal on initial render', () => {
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    const { container } = render(h(App, { ui: mkUi() }));
    expect(container.querySelector('.shell').getAttribute('data-ui-mode')).toBe(UI_MODES.NARRATIVE);
  });

  it('re-renders when tablePhaseSignal changes', async () => {
    const { container } = render(h(App, { ui: mkUi() }));
    expect(container.querySelector('.shell').getAttribute('data-ui-mode')).toBe(UI_MODES.NARRATIVE);
    tablePhaseSignal.value = UI_MODES.COMBAT;
    await Promise.resolve();
    expect(container.querySelector('.shell').getAttribute('data-ui-mode')).toBe(UI_MODES.COMBAT);
  });

  it('exposes data-ui-mode for each valid phase', async () => {
    const { container } = render(h(App, { ui: mkUi() }));
    for (const mode of [UI_MODES.NARRATIVE, UI_MODES.COMBAT, UI_MODES.NARRATIVE]) {
      tablePhaseSignal.value = mode;
      await Promise.resolve();
      expect(container.querySelector('.shell').getAttribute('data-ui-mode')).toBe(mode);
    }
  });
});
