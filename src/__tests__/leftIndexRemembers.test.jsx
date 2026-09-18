/**
 * The left index remembers which sections you left open.
 *
 * Both sections were held in `useState` seeded from a hardcoded
 * default, so collapsing Scenes lasted until the next remount and
 * then silently reopened. It is a reading preference, so it is scoped
 * per user and not per room: which sections you want open does not
 * change when you switch campaign.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { LeftIndex } from '../ui/LeftIndex.jsx';
import { layoutModeSignal } from '../state/ui-signals.js';
import { LAYOUT_MODES, STORAGE_KEYS } from '../utils/constants.js';

function makeUi(userId = '@a:hs') {
  return /** @type {any} */ ({
    state: {
      isGM: () => false,
      scenes: [], pages: new Map(), handouts: new Map(), tables: new Map(),
      maps: new Map(), characters: new Map(), npcs: new Map(),
      settings: { systemConfig: {} },
      activeMapId: null,
    },
    widgetManager: { userId, roomId: '!r:hs' },
  });
}

const head = (container, label) =>
  [...container.querySelectorAll('.left-index__section-head')]
    .find((b) => b.textContent.includes(label));

beforeEach(() => {
  localStorage.clear();
  layoutModeSignal.value = LAYOUT_MODES.TEXT;
});
afterEach(() => cleanup());

describe('the left index accordion', () => {
  it('opens both sections for a reader who has never touched it', () => {
    const { container } = render(h(LeftIndex, { ui: makeUi() }));
    expect(head(container, 'Scenes').getAttribute('aria-expanded')).toBe('true');
    expect(head(container, 'Journal').getAttribute('aria-expanded')).toBe('true');
  });

  it('remembers a collapsed section across a remount', () => {
    const first = render(h(LeftIndex, { ui: makeUi() }));
    fireEvent.click(head(first.container, 'Scenes'));
    expect(head(first.container, 'Scenes').getAttribute('aria-expanded')).toBe('false');
    cleanup();

    const { container } = render(h(LeftIndex, { ui: makeUi() }));
    expect(head(container, 'Scenes').getAttribute('aria-expanded')).toBe('false');
    expect(head(container, 'Journal').getAttribute('aria-expanded')).toBe('true');
  });

  it('does not carry one account’s choice to another', () => {
    const first = render(h(LeftIndex, { ui: makeUi('@a:hs') }));
    fireEvent.click(head(first.container, 'Journal'));
    cleanup();

    const { container } = render(h(LeftIndex, { ui: makeUi('@b:hs') }));
    expect(head(container, 'Journal').getAttribute('aria-expanded')).toBe('true');
  });

  it('stores under a user-scoped key, not a global one', () => {
    const { container } = render(h(LeftIndex, { ui: makeUi('@a:hs') }));
    fireEvent.click(head(container, 'Scenes'));
    expect(localStorage.getItem(STORAGE_KEYS.LEFT_INDEX_SECTIONS)).toBeNull();
    expect(localStorage.getItem(`${STORAGE_KEYS.LEFT_INDEX_SECTIONS}::@a:hs`)).toBeTruthy();
  });

  it('survives a stored value that is not readable', () => {
    localStorage.setItem(`${STORAGE_KEYS.LEFT_INDEX_SECTIONS}::@a:hs`, 'not json');
    const { container } = render(h(LeftIndex, { ui: makeUi('@a:hs') }));
    expect(head(container, 'Scenes').getAttribute('aria-expanded')).toBe('true');
  });
});
