import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';
import { act } from 'preact/test-utils';
import { LeftIndex } from '../ui/LeftIndex.jsx';
import { JournalDrawer } from '../ui/index-sections.js';
import { tableModeSignal, resetUiSignals, layoutModeSignal } from '../state/ui-signals.js';
import { handoutsSignal, pagesSignal } from '../state/signals.js';
import { PAGE_KINDS, LAYOUT_MODES } from '../utils/constants.js';

function makeUi(overrides = {}) {
  const pages = new Map([
    ['p-lore', { id: 'p-lore', title: 'Ancient Lore', kind: PAGE_KINDS.LORE }],
    ['p-prep', { id: 'p-prep', title: 'GM Secrets', kind: PAGE_KINDS.PREP }],
  ]);
  return {
    state: {
      isGM: () => true,
      handouts: new Map(),
      pages,
      roomMembers: [{ userId: '@gm:hs' }],
    },
    widgetManager: { userId: '@gm:hs' },
    showPageForm: vi.fn(),
    showHandoutForm: vi.fn(),
    ...overrides,
  };
}

describe('Task 5: True Live vs. Prep Separation in Left Sidebar', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    resetUiSignals();
    layoutModeSignal.value = LAYOUT_MODES.TEXT;
    handoutsSignal.value = new Map();
    pagesSignal.value = new Map();
  });

  afterEach(() => {
    render(null, host);
    host.remove();
    resetUiSignals();
  });

  it('renders story index sections in LeftIndex', () => {
    const ui = makeUi();
    act(() => render(h(LeftIndex, { ui }), host));
    expect(host.querySelector('[data-section="scenes"]')).not.toBeNull();
    expect(host.querySelector('[data-section="journal"]')).not.toBeNull();
  });

  it('shows prep category in prep mode and hides it in live mode while keeping Write a page CTA available in JournalDrawer', () => {
    const ui = makeUi();
    pagesSignal.value = ui.state.pages;

    tableModeSignal.value = 'prep';
    act(() => render(h(JournalDrawer, { ui }), host));
    expect(host.querySelector('[data-section="prep"]')).not.toBeNull();
    const ctasPrep = Array.from(host.querySelectorAll('.icon-rail__section-cta'));
    expect(ctasPrep.some((el) => el.textContent.includes('Write a page'))).toBe(true);

    tableModeSignal.value = 'live';
    act(() => render(h(JournalDrawer, { ui }), host));
    expect(host.querySelector('[data-section="prep"]')).toBeNull();
    expect(host.querySelector('[data-section="lore"]')).not.toBeNull();
    const ctasLive = Array.from(host.querySelectorAll('.icon-rail__section-cta'));
    expect(ctasLive.some((el) => el.textContent.includes('Write a page'))).toBe(true);
  });
});
