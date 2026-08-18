/**
 * Mobile drawer toggles.
 *
 * The ☰ and Party buttons in the chat column flip
 * shell[data-channels-open] / shell[data-sheet-open]. The scrim closes
 * both. CSS pins the toggles to display:none above 768px so they only
 * affect mobile; this test exercises only the JS contract (data
 * attributes + button wiring), since happy-dom doesn't simulate media
 * queries.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup, fireEvent } from '@testing-library/preact';

vi.mock('../ui/useKeyboardShortcuts.js', () => ({ useKeyboardShortcuts: () => {} }));
// Drawer toggles live inside Header now; the stub renders thin
// wrappers around the callbacks so the shell-level tests can drive
// the open/close flow without pulling in the real Header tree.
vi.mock('../ui/Header.jsx', () => ({
  Header: ({ channelsOpen, sheetOpen, onToggleChannels, onToggleSheet }) =>
    h('div', { 'data-stub': 'header' }, [
      onToggleChannels && h('button', {
        type: 'button',
        class: 'shell__mobile-toggle shell__mobile-toggle--channels',
        'aria-expanded': String(!!channelsOpen),
        onClick: onToggleChannels,
      }, '☰'),
      onToggleSheet && h('button', {
        type: 'button',
        class: 'shell__mobile-toggle shell__mobile-toggle--sheet',
        'aria-expanded': String(!!sheetOpen),
        onClick: onToggleSheet,
      }, 'Party'),
    ]),
}));
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
      isGM: () => false,
    },
    _debugMode: false,
    widgetManager: { userId: '@u:s', roomId: '!r:s' },
  });
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); });

describe('shell mobile drawer toggles', () => {
  it('starts with both drawers closed', () => {
    const { container } = render(h(App, { ui: mkUi() }));
    const shell = container.querySelector('.shell');
    expect(shell.hasAttribute('data-channels-open')).toBe(false);
    expect(shell.hasAttribute('data-sheet-open')).toBe(false);
  });

  it('☰ toggles the channels drawer', () => {
    const { container } = render(h(App, { ui: mkUi() }));
    const channelsBtn = container.querySelector('.shell__mobile-toggle--channels');
    expect(channelsBtn).toBeTruthy();
    fireEvent.click(channelsBtn);
    expect(container.querySelector('.shell').hasAttribute('data-channels-open')).toBe(true);
    fireEvent.click(channelsBtn);
    expect(container.querySelector('.shell').hasAttribute('data-channels-open')).toBe(false);
  });

  it('Party toggles the sheet drawer', () => {
    const { container } = render(h(App, { ui: mkUi() }));
    const sheetBtn = container.querySelector('.shell__mobile-toggle--sheet');
    expect(sheetBtn).toBeTruthy();
    fireEvent.click(sheetBtn);
    expect(container.querySelector('.shell').hasAttribute('data-sheet-open')).toBe(true);
    fireEvent.click(sheetBtn);
    expect(container.querySelector('.shell').hasAttribute('data-sheet-open')).toBe(false);
  });

  it('scrim closes both drawers', () => {
    const { container } = render(h(App, { ui: mkUi() }));
    fireEvent.click(container.querySelector('.shell__mobile-toggle--channels'));
    fireEvent.click(container.querySelector('.shell__mobile-toggle--sheet'));
    const shell = container.querySelector('.shell');
    expect(shell.hasAttribute('data-channels-open')).toBe(true);
    expect(shell.hasAttribute('data-sheet-open')).toBe(true);

    fireEvent.click(container.querySelector('.shell__scrim'));
    expect(shell.hasAttribute('data-channels-open')).toBe(false);
    expect(shell.hasAttribute('data-sheet-open')).toBe(false);
  });

  it('toggle buttons expose aria-expanded that tracks state', () => {
    const { container } = render(h(App, { ui: mkUi() }));
    const channelsBtn = container.querySelector('.shell__mobile-toggle--channels');
    expect(channelsBtn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(channelsBtn);
    expect(channelsBtn.getAttribute('aria-expanded')).toBe('true');
  });
});
