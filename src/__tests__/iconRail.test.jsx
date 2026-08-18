/**
 * IconRail - five-icon left rail with a collapsible drawer panel.
 *
 * Width when collapsed: ~56px (icons only). Clicking an icon opens a
 * drawer with the contents for that section; clicking the same icon
 * again collapses. Only one drawer is open at a time. The MENU icon
 * stays at the top as the catch-all (activity log, debug, help) - it's
 * separate from the five content drawers.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { IconRail } from '../ui/IconRail.jsx';
import {
  openIconRailDrawerSignal, drawerManuallyChosenSignal,
} from '../state/ui-signals.js';
import { ICON_RAIL_DRAWERS } from '../utils/constants.js';

function makeUi({ isGM = false } = {}) {
  return {
    state: {
      isGM: () => isGM,
      handouts: new Map(),
      npcs: new Map(),
      items: new Map(),
      maps: new Map(),
      pages: new Map(),
      settings: { systemConfig: {}, narrative_mode_override: null },
    },
    widgetManager: { userId: '@me:m', roomId: '!r:m' },
    activityLog: [],
  };
}

describe('IconRail', () => {
  beforeEach(() => {
    openIconRailDrawerSignal.value = null;
    drawerManuallyChosenSignal.value = false;
  });
  afterEach(() => { cleanup(); });

  it('renders the story-index content icons (Scenes / Journal) plus a Menu icon', () => {
    const { container } = render(h(IconRail, { ui: makeUi({ isGM: true }) }));
    const ids = Array.from(container.querySelectorAll('[data-drawer]'))
      .map((b) => b.getAttribute('data-drawer'));
    expect(ids).toContain(ICON_RAIL_DRAWERS.SCENES);
    expect(ids).toContain(ICON_RAIL_DRAWERS.JOURNAL);
    expect(ids).toContain(ICON_RAIL_DRAWERS.MENU);
    // NPCs and Items live in the right-rail tabs, not the left rail.
    expect(ids).not.toContain(ICON_RAIL_DRAWERS.NPCS);
    expect(ids).not.toContain(ICON_RAIL_DRAWERS.ITEMS);
    // The Maps manager is a modal, not a drawer.
    expect(ids).not.toContain(ICON_RAIL_DRAWERS.MAPS);
  });

  it('clicking an icon opens its drawer; clicking the same icon collapses it', () => {
    const { container } = render(h(IconRail, { ui: makeUi() }));
    const journal = container.querySelector(`[data-drawer="${ICON_RAIL_DRAWERS.JOURNAL}"]`);
    fireEvent.click(journal);
    expect(openIconRailDrawerSignal.value).toBe(ICON_RAIL_DRAWERS.JOURNAL);
    expect(container.querySelector('.icon-rail__drawer')).not.toBeNull();
    fireEvent.click(journal);
    expect(openIconRailDrawerSignal.value).toBeNull();
    expect(container.querySelector('.icon-rail__drawer')).toBeNull();
  });

  it('opening a second drawer closes the first', () => {
    const { container } = render(h(IconRail, { ui: makeUi() }));
    fireEvent.click(container.querySelector(`[data-drawer="${ICON_RAIL_DRAWERS.JOURNAL}"]`));
    fireEvent.click(container.querySelector(`[data-drawer="${ICON_RAIL_DRAWERS.SCENES}"]`));
    expect(openIconRailDrawerSignal.value).toBe(ICON_RAIL_DRAWERS.SCENES);
    expect(container.querySelectorAll('.icon-rail__drawer').length).toBe(1);
  });

  it('icon buttons mark aria-current on the open drawer', () => {
    const { container } = render(h(IconRail, { ui: makeUi() }));
    const journal = container.querySelector(`[data-drawer="${ICON_RAIL_DRAWERS.JOURNAL}"]`);
    fireEvent.click(journal);
    expect(journal.getAttribute('aria-current')).toBe('true');
    const scenes = container.querySelector(`[data-drawer="${ICON_RAIL_DRAWERS.SCENES}"]`);
    expect(scenes.getAttribute('aria-current')).toBe('false');
  });

  it('hides the Maps icon for non-GMs', () => {
    const { container } = render(h(IconRail, { ui: makeUi({ isGM: false }) }));
    expect(container.querySelector(`[data-drawer="${ICON_RAIL_DRAWERS.MAPS}"]`)).toBeNull();
  });

  it('user click flips drawerManuallyChosenSignal so mode defaults stop overriding', () => {
    const { container } = render(h(IconRail, { ui: makeUi() }));
    fireEvent.click(container.querySelector(`[data-drawer="${ICON_RAIL_DRAWERS.JOURNAL}"]`));
    expect(drawerManuallyChosenSignal.value).toBe(true);
  });
});
