/**
 * Shared navigation drawer bodies (index-sections.js) - behavioral coverage.
 *
 * These bodies back BOTH the desktop LeftIndex and the mobile IconRail;
 * without direct tests only lint catches the symbols getting
 * deleted. These tests assert the real behavior (rows render from state,
 * clicks route to channels / docs / tabs) and double as a corruption canary:
 * rendering JournalDrawer fails if JOURNAL_CATEGORIES / JournalSection vanish.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';

// Routing seams - mock so we can assert the navigation calls.
vi.mock('../ui/FloatingDoc.jsx', () => ({ openDoc: vi.fn() }));
vi.mock('../ui/SceneStartModal.js', () => ({ showSceneStartModal: vi.fn() }));

import {
  ScenesDrawer, JournalDrawer, JournalSection, JOURNAL_CATEGORIES,
  NPCsDrawer, ItemsDrawer,
} from '../ui/index-sections.js';
import { openDoc } from '../ui/FloatingDoc.jsx';
import { activeChannelSignal, logVersionSignal } from '../state/ui-signals.js';
import {
  settingsSignal, handoutsSignal, pagesSignal, npcsSignal, itemsSignal,
} from '../state/signals.js';
import { CHANNEL_KEYS, TABS, PAGE_KINDS } from '../utils/constants.js';

function makeUi(/** @type {any} */ { isGM = true, ...over } = {}) {
  return /** @type {any} */ ({
    state: {
      isGM: () => isGM,
      handouts: new Map(),
      npcs: new Map(),
      items: new Map(),
      pages: new Map(),
      settings: { systemConfig: {} },
    },
    activityLog: [],
    selectNPCById: vi.fn(),
    switchTab: vi.fn(),
    createNPC: vi.fn(),
    createItem: vi.fn(),
    showHandoutForm: vi.fn(),
    openMapsPanel: vi.fn(),
    ...over,
  });
}

const rowByText = (container, text) =>
  Array.from(container.querySelectorAll('.icon-rail__row'))
    .find((b) => b.textContent.includes(text));

beforeEach(() => {
  activeChannelSignal.value = null;
  logVersionSignal.value = 0;
  settingsSignal.value = { systemConfig: {} };
  handoutsSignal.value = new Map();
  pagesSignal.value = new Map();
  npcsSignal.value = new Map();
  itemsSignal.value = new Map();
  vi.mocked(openDoc).mockClear();
});
afterEach(() => cleanup());

describe('ScenesDrawer', () => {
  it('shows the empty state when there are no scenes', () => {
    const { container } = render(h(ScenesDrawer, { ui: makeUi() }));
    expect(container.textContent).toContain('No scene threads started');
  });

  it('renders a row per scene-root (title + sender) and routes clicks to the scene channel', () => {
    const ui = makeUi({
      activityLog: [
        { eventId: 'evt-1', isSceneRoot: true, sceneTitle: 'The Throne Room', sender: '@dm:matrix.org' },
        { eventId: 'evt-2', isSceneRoot: false }, // not a scene root → excluded
      ],
    });
    logVersionSignal.value = 1;
    const { container } = render(h(ScenesDrawer, { ui }));
    expect(container.querySelectorAll('.icon-rail__row')).toHaveLength(1);
    const row = rowByText(container, 'The Throne Room');
    expect(row.textContent).toContain('dm');

    fireEvent.click(row);
    expect(activeChannelSignal.value).toBe(`${CHANNEL_KEYS.SCENE_PREFIX}evt-1`);
  });
});

describe('JournalDrawer', () => {
  it('renders handout + page rows and routes clicks through openDoc', () => {
    const handouts = new Map([['h1', { id: 'h1', title: 'Local Rumors', visible_to_players: true }]]);
    // Journal + Handouts are the categories open by default in the drawer.
    const pages = new Map([['p1', { id: 'p1', title: 'Session Notes', kind: PAGE_KINDS.JOURNAL, visibility: 'players' }]]);
    const ui = makeUi();
    ui.state.handouts = handouts;
    ui.state.pages = pages;
    handoutsSignal.value = handouts;
    pagesSignal.value = pages;

    const { container } = render(h(JournalDrawer, { ui }));
    expect(container.textContent).toContain('Local Rumors');
    expect(container.textContent).toContain('Session Notes');

    fireEvent.click(rowByText(container, 'Local Rumors'));
    expect(openDoc).toHaveBeenCalledWith('handout', 'h1');

    fireEvent.click(rowByText(container, 'Session Notes'));
    expect(openDoc).toHaveBeenCalledWith('page', 'p1');
  });

  it('hides the GM-only Prep category for non-GMs', () => {
    const pages = new Map([['p1', { id: 'p1', title: 'Secret Prep', kind: PAGE_KINDS.PREP, visibility: 'players' }]]);
    const ui = makeUi({ isGM: false });
    ui.state.pages = pages;
    pagesSignal.value = pages;
    const { container } = render(h(JournalDrawer, { ui }));
    expect(container.textContent).not.toContain('Secret Prep');
  });

  it('shows the empty state when there are no handouts or pages', () => {
    const { container } = render(h(JournalDrawer, { ui: makeUi() }));
    expect(container.textContent).toContain('No journal entries yet');
  });
});

describe('JournalSection (collapse chrome)', () => {
  it('toggles aria-expanded when its header is clicked', () => {
    const onToggle = vi.fn();
    const { container, rerender } = render(h(JournalSection, {
      label: 'Lore', count: 2, isOpen: false, onToggle, children: [],
    }));
    const head = container.querySelector('.icon-rail__section-head');
    expect(head.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(head);
    expect(onToggle).toHaveBeenCalled();
    rerender(h(JournalSection, { label: 'Lore', count: 2, isOpen: true, onToggle, children: [] }));
    expect(container.querySelector('.icon-rail__section-head').getAttribute('aria-expanded')).toBe('true');
  });

  it('exposes the five journal categories (canary against symbol deletion)', () => {
    expect(JOURNAL_CATEGORIES.map((c) => c.key)).toEqual(['handouts', 'journal', 'lore', 'fiction', 'prep']);
  });
});

describe('NPCsDrawer', () => {
  it('renders NPC rows (name + CR) and selecting one opens its sheet tab', () => {
    const npcs = new Map([['npc-1', { id: 'npc-1', name: 'Goblin Archer', cr: 1 }]]);
    const ui = makeUi();
    ui.state.npcs = npcs;
    npcsSignal.value = npcs;
    const { container } = render(h(NPCsDrawer, { ui }));
    expect(container.textContent).toContain('Goblin Archer');
    expect(container.textContent).toContain('CR 1');

    fireEvent.click(rowByText(container, 'Goblin Archer'));
    expect(ui.selectNPCById).toHaveBeenCalledWith('npc-1');
    expect(ui.switchTab).toHaveBeenCalledWith(TABS.NPC);
  });

  it('shows the empty state when there are no NPCs', () => {
    const { container } = render(h(NPCsDrawer, { ui: makeUi() }));
    expect(container.textContent).toContain('No NPCs yet');
  });
});

describe('ItemsDrawer', () => {
  it('renders item rows (name + kind) and clicking one opens the Items tab', () => {
    const items = new Map([['i-1', { id: 'i-1', name: 'Longsword', kind: 'weapon' }]]);
    const ui = makeUi();
    ui.state.items = items;
    itemsSignal.value = items;
    const { container } = render(h(ItemsDrawer, { ui }));
    expect(container.textContent).toContain('Longsword');
    expect(container.textContent).toContain('weapon');

    fireEvent.click(rowByText(container, 'Longsword'));
    expect(ui.switchTab).toHaveBeenCalledWith(TABS.ITEMS);
  });

  it('shows the empty state when there are no items', () => {
    const { container } = render(h(ItemsDrawer, { ui: makeUi() }));
    expect(container.textContent).toContain('No items yet');
  });
});
