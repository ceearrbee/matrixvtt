/**
 * MapStrip drawing toolbar - group-driven contextual behavior.
 *
 *   - Combat:    locked to Navigation (pointer + measure); group tabs
 *                aria-disabled and clicks no-op.
 *   - Narrative: toolbar present and unlocked, defaulting to the Navigation
 *                group; drawing/wall tools surface when the user switches
 *                groups (or enters prep). The map shares the column with chat.
 *   - Prep:      group tabs unlocked; user can switch Nav / Draw / GM.
 *                Represented by narrative phase + gmPrepActiveSignal=true.
 *
 * The point of progressive disclosure is that only the *active group's*
 * tools render at any time - no more "everything on screen at once."
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { MapStrip } from '../ui/MapStrip.jsx';
import { tablePhaseSignal, gmPrepActiveSignal, activeToolGroupSignal } from '../state/ui-signals.js';
import { UI_MODES, TOOL_GROUPS } from '../utils/constants.js';

function mkUi({ isGM = false } = {}) {
  return /** @type {any} */ ({
    state: { isGM: () => isGM, map: null },
    pingLocation: () => {},
    setDrawTool: () => {},
    setDrawColor: () => {},
    setDrawWidth: () => {},
    undoDrawing: () => {},
    redoDrawing: () => {},
    clearDrawings: () => {},
    dismissMapHelp: () => {},
  });
}

function toolIds(container) {
  return Array.from(container.querySelectorAll('[data-tool]'))
    .map((b) => b.getAttribute('data-tool'));
}

beforeEach(() => {
  tablePhaseSignal.value = UI_MODES.NARRATIVE;
  gmPrepActiveSignal.value = false;
  activeToolGroupSignal.value = TOOL_GROUPS.NAVIGATION;
});
afterEach(() => {
  cleanup();
  tablePhaseSignal.value = UI_MODES.NARRATIVE;
  gmPrepActiveSignal.value = false;
  activeToolGroupSignal.value = TOOL_GROUPS.NAVIGATION;
});

describe('MapStrip toolbar - contextual groups', () => {
  it('narrative mode shows the toolbar, defaulting to Navigation', () => {
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    const { container } = render(h(MapStrip, { ui: mkUi() }));
    expect(container.querySelector('.draw-toolbar')).not.toBeNull();
    const ids = toolIds(container);
    expect(ids).toContain('pointer');
    expect(ids).toContain('measure');
    // Not locked: group tabs are switchable (unlike Combat).
    const navTab = container.querySelector(`[data-tool-group="${TOOL_GROUPS.NAVIGATION}"]`);
    expect(navTab.getAttribute('aria-disabled')).toBe('false');
  });

  it('combat mode locks the toolbar to Navigation (pointer + measure)', () => {
    tablePhaseSignal.value = UI_MODES.COMBAT;
    activeToolGroupSignal.value = TOOL_GROUPS.DRAWING; // user tried to switch
    const { container } = render(h(MapStrip, { ui: mkUi() }));
    const ids = toolIds(container);
    expect(ids).toContain('pointer');
    expect(ids).toContain('measure');
    for (const id of ['pencil', 'line', 'rect', 'circle']) {
      expect(ids).not.toContain(id);
    }
    // Group tabs render but are aria-disabled in Combat.
    const navTab = container.querySelector(`[data-tool-group="${TOOL_GROUPS.NAVIGATION}"]`);
    expect(navTab.getAttribute('aria-disabled')).toBe('true');
  });

  it('Prep mode: switching to the Drawing group surfaces pencil / line / rect / circle', () => {
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    gmPrepActiveSignal.value = true;
    const { container } = render(h(MapStrip, { ui: mkUi({ isGM: true }) }));
    // Default group is Navigation, so drawing tools are hidden.
    expect(toolIds(container)).not.toContain('pencil');
    fireEvent.click(container.querySelector(`[data-tool-group="${TOOL_GROUPS.DRAWING}"]`));
    const ids = toolIds(container);
    for (const id of ['pencil', 'line', 'rect', 'circle']) {
      expect(ids).toContain(id);
    }
  });

  it('Prep mode: switching to the GM group reveals wall + template-circle for GMs', () => {
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    gmPrepActiveSignal.value = true;
    const { container } = render(h(MapStrip, { ui: mkUi({ isGM: true }) }));
    fireEvent.click(container.querySelector(`[data-tool-group="${TOOL_GROUPS.GM}"]`));
    const ids = toolIds(container);
    expect(ids).toContain('wall');
    expect(ids).toContain('template-circle');
  });

  it('non-GMs never see the GM group tab', () => {
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    gmPrepActiveSignal.value = true;
    const { container } = render(h(MapStrip, { ui: mkUi({ isGM: false }) }));
    expect(container.querySelector(`[data-tool-group="${TOOL_GROUPS.GM}"]`)).toBeNull();
  });
});
