import { describe, it, expect, vi, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { MapStrip } from '../ui/MapStrip.jsx';
import { activeMapIdSignal, mapsSignal } from '../state/signals.js';

vi.mock('../map-renderer.js', () => ({
  MapRenderer: class {
    constructor() {}
    render() {}
    destroy() {}
  }
}));

afterEach(() => { cleanup(); });

function makeUI(extra = {}) {
  // The help banner is about token interactions and only renders
  // when an active map is loaded - otherwise the empty-state
  // placeholder owns the screen. Seed an active map so the help
  // gates open.
  activeMapIdSignal.value = 'm-1';
  const map = { id: 'm-1', width_cells: 10, height_cells: 10, cell_px: 40 };
  mapsSignal.value = new Map([['m-1', map]]);
  return {
    state: {
      tokens: new Map(),
      drawings: [],
      activeMapId: 'm-1',
      map,
      isGM: () => true,
    },
    shouldShowMapHelp: vi.fn(() => true),
    dismissMapHelp: vi.fn(),
    setDrawTool: () => {},
    setDrawColor: () => {},
    setDrawWidth: () => {},
    pingLocation: () => {},
    clearDrawings: () => {},
    zoomIn: () => {},
    zoomOut: () => {},
    undoDrawing: () => {},
    redoDrawing: () => {},
    ...extra,
  };
}

describe('map help panel', () => {
  it('renders the first-use help by default', () => {
    const { getByText } = render(h(MapStrip, { ui: makeUI() }));
    expect(getByText(/Use the pointer tool/)).toBeTruthy();
  });

  it('persists dismissal and hides the panel on future renders', async () => {
    const ui = makeUI();
    const { getByText, queryByText } = render(h(MapStrip, { ui }));

    const btn = getByText('Dismiss');
    fireEvent.click(btn);

    expect(ui.dismissMapHelp).toHaveBeenCalledTimes(1);
    expect(queryByText(/Use the pointer tool/)).toBeNull();
  });
});
