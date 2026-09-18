/**
 * The map's tools wait for a map.
 *
 * A fresh campaign has no map, so the strip renders its "No active map"
 * placeholder - and, until now, rendered the full drawing toolbar and
 * the zoom controls above it anyway: twelve controls for picking a
 * stroke colour, measuring distances and zooming, on a canvas that does
 * not exist. It was the largest block of dead chrome in the first thing
 * a new GM ever sees, sitting directly on top of the one CTA that
 * matters.
 *
 * PRODUCT.md principle 5: show what the current role and moment need.
 * A moment with no map needs "add a map".
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, h } from 'preact';
import { MapStrip } from '../ui/MapStrip.jsx';
import { activeMapIdSignal, mapsSignal, tokensSignal } from '../state/signals.js';
import { tablePhaseSignal, gmPrepActiveSignal, activeToolGroupSignal } from '../state/ui-signals.js';
import { UI_MODES, TOOL_GROUPS } from '../utils/constants.js';

function makeUi({ isGM = true, hasMap = false } = {}) {
  const map = { id: 'm-1', name: 'Crypt', width_cells: 20, height_cells: 20, cell_px: 40 };
  activeMapIdSignal.value = hasMap ? 'm-1' : null;
  mapsSignal.value = hasMap ? new Map([['m-1', map]]) : new Map();
  tokensSignal.value = new Map();
  return /** @type {any} */ ({
    state: {
      isGM: () => isGM,
      map: hasMap ? map : null,
      maps: mapsSignal.value,
      tokens: new Map(),
      settings: { name: 'r', systemConfig: {}, gm_user_ids: isGM ? ['@me:m'] : [] },
      initiative: { active: false, round: 0, current_index: 0, order: [] },
      fog: { mode: null, revealed: [] },
    },
    widgetManager: { userId: '@me:m', roomId: '!r:m' },
    openMapsPanel: () => {},
    pingLocation: () => {},
    setDrawTool: () => {}, setDrawColor: () => {}, setDrawWidth: () => {},
    undoDrawing: () => {}, redoDrawing: () => {}, clearDrawings: () => {},
    zoomIn: () => {}, zoomOut: () => {}, dismissMapHelp: () => {},
  });
}

describe('map chrome waits for a map', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    gmPrepActiveSignal.value = false;
    activeToolGroupSignal.value = TOOL_GROUPS.NAVIGATION;
  });
  afterEach(() => {
    render(null, host);
    host.remove();
    activeMapIdSignal.value = null;
    mapsSignal.value = new Map();
  });

  it('renders no drawing toolbar when there is no active map', () => {
    render(h(MapStrip, { ui: makeUi({ hasMap: false }) }), host);
    expect(host.querySelector('.draw-toolbar')).toBeNull();
  });

  it('renders no zoom controls when there is no active map', () => {
    render(h(MapStrip, { ui: makeUi({ hasMap: false }) }), host);
    expect(host.querySelector('.map-controls')).toBeNull();
  });

  it('leaves the empty-state CTA as the only control on the strip', () => {
    render(h(MapStrip, { ui: makeUi({ isGM: true, hasMap: false }) }), host);
    const strip = host.querySelector('.map-strip');
    const controls = [...strip.querySelectorAll('button, input, select')]
      .filter((el) => !el.closest('.map-strip__collapse'));
    expect(controls.map((el) => el.textContent.trim())).toEqual(['Add a map']);
  });

  it('a player with no map sees no controls at all beyond the collapse toggle', () => {
    render(h(MapStrip, { ui: makeUi({ isGM: false, hasMap: false }) }), host);
    const strip = host.querySelector('.map-strip');
    const controls = [...strip.querySelectorAll('button, input, select')]
      .filter((el) => !el.closest('.map-strip__collapse'));
    expect(controls).toHaveLength(0);
  });

  it('brings the toolbar and zoom back the moment a map loads', () => {
    render(h(MapStrip, { ui: makeUi({ hasMap: true }) }), host);
    expect(host.querySelector('.draw-toolbar')).not.toBeNull();
    expect(host.querySelector('.map-controls')).not.toBeNull();
  });

  it('keeps the collapse toggle so an empty strip can still be tucked away', () => {
    render(h(MapStrip, { ui: makeUi({ hasMap: false }) }), host);
    expect(host.querySelector('.map-strip__collapse')).not.toBeNull();
  });
});
