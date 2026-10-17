import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup, act } from '@testing-library/preact';

vi.mock('../ui/useKeyboardShortcuts.js', () => ({ useKeyboardShortcuts: () => {} }));
vi.mock('../ui/InitiativeBar.jsx', () => ({ InitiativeBar: () => h('div', { 'data-stub': 'init' }) }));
vi.mock('../ui/MapStrip.jsx', () => ({ MapStrip: () => h('div', { 'data-stub': 'map' }) }));
vi.mock('../ui/LogContainer.jsx', () => ({ LogContainer: () => h('div', { 'data-stub': 'log' }) }));
vi.mock('../ui/DiceBar.jsx', () => ({ DiceBar: () => h('div', { 'data-stub': 'dice' }) }));
vi.mock('../ui/LeftIndex.jsx', () => ({ LeftIndex: () => h('div', { 'data-stub': 'left-index' }) }));
vi.mock('../ui/sync/SyncProgress.jsx', () => ({ SyncProgress: () => null }));
vi.mock('../ui/NextSteps.jsx', () => ({ NextSteps: () => null }));
vi.mock('../ui/FloatingDoc.jsx', () => ({ FloatingDocs: () => null }));
vi.mock('../ui/LegacyChatPopups.jsx', () => ({ LegacyChatPopups: () => null }));

import { App } from '../ui/App.jsx';
import { RightCompanion } from '../ui/RightCompanion.jsx';
import {
  companionCollapsedSignal,
  leftRailCollapsedSignal,
  resetUiSignals,
  tablePhaseSignal,
  activeTabSignal,
  selectedCharacterIdSignal,
  selectedTokenSignal,
} from '../state/ui-signals.js';
import { settingsSignal, initiativeSignal } from '../state/signals.js';
import { TABS, UI_MODES } from '../utils/constants.js';

function makeUi(overrides = {}) {
  const characters = new Map([
    ['char-1', { id: 'char-1', name: 'Aria', inventory_ids: [] }],
  ]);
  const tokens = new Map([
    ['tok-1', { id: 'tok-1', name: 'Aria Token', sheet_id: 'char-1' }],
  ]);
  return {
    state: {
      isGM: () => true,
      characters,
      npcs: new Map(),
      tokens,
      items: new Map(),
      maps: new Map(),
      spells: new Map(),
      handouts: new Map(),
      tables: new Map(),
      pages: new Map(),
      pins: new Map(),
      walls: new Map(),
      lights: new Map(),
      templates: new Map(),
      drawings: [],
      roomMembers: [{ userId: '@me:m' }],
      settings: { name: 'Test Campaign', systemConfig: {}, gm_user_ids: ['@me:m'] },
      initiative: { active: false, round: 0, current_index: 0, order: [] },
      fog: { mode: null, revealed: [] },
      activeMapId: null,
      powerLevels: null,
      damageLog: [],
      pendingKnocks: [],
      getCurrentCharacter: () => characters.get('char-1'),
      canEditEntity: () => true,
      isTokenVisibleToPlayer: () => true,
      hasTokenForSheet: () => false,
    },
    widgetManager: { userId: '@me:m', roomId: '!r:m', canLeave: true, isAppClient: true },
    _isMyCombatTurn: () => false,
    _currentTab: 'sheet',
    chat: { announcements: {} },
    _latestDiceResult: '',
    activityLog: [],
    switchTab: vi.fn((tab) => { activeTabSignal.value = tab; }),
    ...overrides,
  };
}

describe('Task 1: Collapsible Right Companion on Desktop', () => {
  beforeEach(() => {
    resetUiSignals();
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    activeTabSignal.value = TABS.PARTY;
    selectedCharacterIdSignal.value = null;
    selectedTokenSignal.value = null;
    settingsSignal.value = { name: 'Test Campaign', systemConfig: {} };
    initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
  });

  afterEach(() => {
    cleanup();
    resetUiSignals();
    vi.restoreAllMocks();
  });

  it('companionCollapsedSignal defaults to false and resetUiSignals resets it', () => {
    expect(companionCollapsedSignal.value).toBe(false);
    companionCollapsedSignal.value = true;
    expect(companionCollapsedSignal.value).toBe(true);
    resetUiSignals();
    expect(companionCollapsedSignal.value).toBe(false);
  });

  it('renders collapse toggle button in RightCompanion and toggles signal', () => {
    const ui = makeUi();
    const { container, rerender } = render(h(RightCompanion, { ui }));

    const collapseBtn = container.querySelector('.ctab--collapse');
    expect(collapseBtn).not.toBeNull();
    expect(collapseBtn.getAttribute('aria-label')).toBe('Collapse companion panel');
    expect(collapseBtn.getAttribute('title')).toBe('Collapse panel');

    fireEvent.click(collapseBtn);
    expect(companionCollapsedSignal.value).toBe(true);

    rerender(h(RightCompanion, { ui }));
    const expandBtn = container.querySelector('.ctab--collapse');
    expect(expandBtn).not.toBeNull();
    expect(expandBtn.getAttribute('aria-label')).toBe('Expand companion panel');
    expect(expandBtn.getAttribute('title')).toBe('Expand panel');

    fireEvent.click(expandBtn);
    expect(companionCollapsedSignal.value).toBe(false);
  });

  it('binds data-companion-collapsed="true" on .shell when companionCollapsedSignal is true', () => {
    const ui = makeUi();
    const { container } = render(h(App, { ui }));
    const shell = container.querySelector('.shell');
    expect(shell).not.toBeNull();
    expect(shell.getAttribute('data-companion-collapsed')).toBeNull();

    act(() => {
      companionCollapsedSignal.value = true;
    });
    expect(shell.getAttribute('data-companion-collapsed')).toBe('true');

    act(() => {
      companionCollapsedSignal.value = false;
    });
    expect(shell.getAttribute('data-companion-collapsed')).toBeNull();
  });

  it('auto-expands companion panel when ui.switchTab is called', () => {
    const ui = makeUi();
    const { container } = render(h(App, { ui }));
    const shell = container.querySelector('.shell');

    act(() => {
      companionCollapsedSignal.value = true;
    });
    expect(shell.getAttribute('data-companion-collapsed')).toBe('true');

    act(() => {
      ui.switchTab(TABS.SHEET);
    });
    expect(companionCollapsedSignal.value).toBe(false);
    expect(shell.getAttribute('data-companion-collapsed')).toBeNull();
  });

  it('auto-expands companion panel when combat mode is activated', () => {
    const ui = makeUi();
    const { container } = render(h(App, { ui }));
    const shell = container.querySelector('.shell');

    act(() => {
      companionCollapsedSignal.value = true;
    });
    expect(shell.getAttribute('data-companion-collapsed')).toBe('true');

    act(() => {
      tablePhaseSignal.value = UI_MODES.COMBAT;
    });
    expect(companionCollapsedSignal.value).toBe(false);
    expect(shell.getAttribute('data-companion-collapsed')).toBeNull();
  });

  it('auto-expands companion panel when character/token is selected', () => {
    const ui = makeUi();
    const { container } = render(h(App, { ui }));
    const shell = container.querySelector('.shell');

    act(() => {
      companionCollapsedSignal.value = true;
    });
    expect(shell.getAttribute('data-companion-collapsed')).toBe('true');

    act(() => {
      selectedCharacterIdSignal.value = 'char-1';
    });
    expect(companionCollapsedSignal.value).toBe(false);
    expect(shell.getAttribute('data-companion-collapsed')).toBeNull();
  });

  it('leftRailCollapsedSignal defaults to false and resets cleanly', () => {
    expect(leftRailCollapsedSignal.value).toBe(false);
    leftRailCollapsedSignal.value = true;
    expect(leftRailCollapsedSignal.value).toBe(true);
    resetUiSignals();
    expect(leftRailCollapsedSignal.value).toBe(false);
  });
});
