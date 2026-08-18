/**
 * Drawing toolbar - contextual group exposure.
 *
 * Previously this file asserted Exploration-mode three-tool collapse +
 * "More tools" expander; the group model supersedes that. Now:
 *   - default group is Navigation (pointer + measure) regardless of phase
 *   - clicking the Drawing group tab reveals pencil/line/rect/circle
 *   - clicking the GM tab reveals wall/template-circle (GMs only)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { h } from 'preact';
import { render, fireEvent } from '@testing-library/preact';
import { MapStrip } from '../ui/MapStrip.jsx';
import { tablePhaseSignal, gmPrepActiveSignal, activeToolGroupSignal } from '../state/ui-signals.js';
import { UI_MODES, TOOL_GROUPS } from '../utils/constants.js';

function mkUi({ isGM = false } = {}) {
  return {
    state: { isGM: () => isGM, map: null },
    pingLocation: () => {},
    setDrawTool: () => {},
    setDrawColor: () => {},
    setDrawWidth: () => {},
    undoDrawing: () => {},
    redoDrawing: () => {},
    clearDrawings: () => {},
    dismissMapHelp: () => {},
  };
}

function toolIds(container) {
  return Array.from(container.querySelectorAll('[data-tool]'))
    .map((b) => b.getAttribute('data-tool'));
}

describe('draw toolbar - contextual groups', () => {
  beforeEach(() => {
    // MapStrip unmounts in Narrative without prep; activate prep mode so
    // the group model can be exercised.
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    gmPrepActiveSignal.value = true;
    activeToolGroupSignal.value = TOOL_GROUPS.NAVIGATION;
  });

  it('default group is Navigation: pointer + measure only', () => {
    const { container } = render(h(MapStrip, { ui: mkUi() }));
    const ids = toolIds(container);
    expect(ids).toContain('pointer');
    expect(ids).toContain('measure');
    for (const id of ['pencil', 'line', 'rect', 'circle']) {
      expect(ids).not.toContain(id);
    }
  });

  it('clicking the Drawing group tab swaps in the drawing tools', () => {
    const { container } = render(h(MapStrip, { ui: mkUi() }));
    fireEvent.click(container.querySelector(`[data-tool-group="${TOOL_GROUPS.DRAWING}"]`));
    const ids = toolIds(container);
    for (const id of ['pencil', 'line', 'rect', 'circle']) {
      expect(ids).toContain(id);
    }
    expect(ids).not.toContain('pointer');
  });

  it('switching back to Navigation hides drawing tools again', () => {
    const { container } = render(h(MapStrip, { ui: mkUi() }));
    fireEvent.click(container.querySelector(`[data-tool-group="${TOOL_GROUPS.DRAWING}"]`));
    fireEvent.click(container.querySelector(`[data-tool-group="${TOOL_GROUPS.NAVIGATION}"]`));
    const ids = toolIds(container);
    expect(ids).toContain('pointer');
    expect(ids).not.toContain('pencil');
  });
});
