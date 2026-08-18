/**
 * LeftIndex - the always-expanded multi-section index for the Almanac shell.
 *
 * Replaces the icon-rail's one-drawer-at-a-time model: every section
 * (Scenes / Journal / NPCs / Items / Maps·GM) is visible and individually
 * collapsible, with a footer ☰ that opens the consolidated GlobalMenu.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h } from 'preact';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { LeftIndex } from '../ui/LeftIndex.jsx';
import {
  settingsSignal, handoutsSignal, pagesSignal, npcsSignal, itemsSignal,
} from '../state/signals.js';
import { logVersionSignal, activeChannelSignal } from '../state/ui-signals.js';
import { CHANNEL_KEYS } from '../utils/constants.js';

function makeUi(/** @type {any} */ { isGM = false, ...over } = {}) {
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
    ...over,
  });
}

const head = (container, section) =>
  container.querySelector(`[data-section="${section}"] .left-index__section-head`);

beforeEach(() => {
  settingsSignal.value = { systemConfig: {} };
  handoutsSignal.value = new Map();
  pagesSignal.value = new Map();
  npcsSignal.value = new Map();
  itemsSignal.value = new Map();
  logVersionSignal.value = 0;
  activeChannelSignal.value = null;
});
afterEach(() => cleanup());

describe('LeftIndex - multi-section index', () => {
  it('renders the Scenes and Journal section headers (the story index)', () => {
    const { container } = render(h(LeftIndex, { ui: makeUi() }));
    for (const s of ['scenes', 'journal']) {
      expect(head(container, s)).not.toBeNull();
    }
  });

  it('does not duplicate NPCs / Items here (they live in the right-rail tabs)', () => {
    const { container } = render(h(LeftIndex, { ui: makeUi() }));
    expect(head(container, 'npcs')).toBeNull();
    expect(head(container, 'items')).toBeNull();
  });

  it('has no Maps section for anyone; the Maps manager lives in the menu', () => {
    const gm = render(h(LeftIndex, { ui: makeUi({ isGM: true }) }));
    expect(head(gm.container, 'maps')).toBeNull();
  });

  it('toggles a section open/closed via its header', () => {
    const { container } = render(h(LeftIndex, { ui: makeUi() }));
    const scenes = head(container, 'scenes');
    const before = scenes.getAttribute('aria-expanded');
    fireEvent.click(scenes);
    expect(scenes.getAttribute('aria-expanded')).not.toBe(before);
  });

  it('renders a footer with the single consolidated Menu control', () => {
    const { container } = render(h(LeftIndex, { ui: makeUi() }));
    const foot = container.querySelector('.left-index__foot');
    expect(foot).not.toBeNull();
    const buttons = Array.from(foot.querySelectorAll('button'));
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toMatch(/Menu/);
  });
});

describe('LeftIndex - populated sections route through the index', () => {
  const body = (container, section) =>
    container.querySelector(`[data-section="${section}"] .left-index__section-body`);

  it('shows seeded scene rows (Scenes is open by default) and routes a click to the scene channel', () => {
    const ui = makeUi({
      activityLog: [{ eventId: 'evt-9', isSceneRoot: true, sceneTitle: 'Gatehouse Standoff', sender: '@dm:m' }],
    });
    logVersionSignal.value = 1;
    const { container } = render(h(LeftIndex, { ui }));
    const scenes = body(container, 'scenes');
    expect(scenes.textContent).toContain('Gatehouse Standoff');

    fireEvent.click(scenes.querySelector('.icon-rail__row'));
    expect(activeChannelSignal.value).toBe(`${CHANNEL_KEYS.SCENE_PREFIX}evt-9`);
  });
});
