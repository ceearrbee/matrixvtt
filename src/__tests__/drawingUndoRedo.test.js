import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { MapStrip } from '../ui/MapStrip.jsx';
import { tablePhaseSignal, gmPrepActiveSignal } from '../state/ui-signals.js';
import { UI_MODES } from '../utils/constants.js';

vi.mock('../map-renderer.js', () => ({
  MapRenderer: class {
    constructor() {}
    render() {}
    destroy() {}
  }
}));

// Toolbar now renders in every phase; prep is enabled so GM tools are reachable.
beforeEach(() => { tablePhaseSignal.value = UI_MODES.NARRATIVE; gmPrepActiveSignal.value = true; });
afterEach(() => { cleanup(); tablePhaseSignal.value = UI_MODES.NARRATIVE; gmPrepActiveSignal.value = false; });

function makeUI(extra = {}) {
  return {
    state: { 
      tokens: new Map(),
      drawings: [],
      activeMapId: null,
      isGM: () => true 
    },
    shouldShowMapHelp: () => false,
    dismissMapHelp: () => {},
    setDrawTool: () => {},
    setDrawColor: () => {},
    setDrawWidth: () => {},
    pingLocation: () => {},
    clearDrawings: () => {},
    zoomIn: () => {},
    zoomOut: () => {},
    undoDrawing: vi.fn().mockResolvedValue(undefined),
    redoDrawing: vi.fn().mockResolvedValue(undefined),
    ...extra,
  };
}

describe('drawing toolbar undo/redo buttons', () => {
  it('renders undo and redo buttons with correct data-action', () => {
    const { container } = render(h(MapStrip, { ui: makeUI() }));
    expect(container.querySelector('[data-action="undo-drawing"]')).toBeTruthy();
    expect(container.querySelector('[data-action="redo-drawing"]')).toBeTruthy();
  });

  it('undo button click calls ui.undoDrawing()', async () => {
    const ui = makeUI();
    const { container } = render(h(MapStrip, { ui }));
    fireEvent.click(container.querySelector('[data-action="undo-drawing"]'));
    await Promise.resolve();
    expect(ui.undoDrawing).toHaveBeenCalledTimes(1);
  });

  it('redo button click calls ui.redoDrawing()', async () => {
    const ui = makeUI();
    const { container } = render(h(MapStrip, { ui }));
    fireEvent.click(container.querySelector('[data-action="redo-drawing"]'));
    await Promise.resolve();
    expect(ui.redoDrawing).toHaveBeenCalledTimes(1);
  });
});
