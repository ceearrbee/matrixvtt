/**
 * MapStrip - empty-state placeholder.
 *
 * When the room has no active map, the canvas area renders as a
 * black void on mobile (the visible 1fr grid row with nothing in it)
 * and gives the user no idea what to do. Render a clear placeholder
 * with a hint: GMs see a CTA to open the maps panel; players see a
 * "waiting for GM" message.
 */
import { describe, it, expect } from 'vitest';
import { render, h } from 'preact';
import { MapStrip } from '../ui/MapStrip.jsx';
import { activeMapIdSignal, mapsSignal } from '../state/signals.js';

function makeUi({ isGM = false, hasMap = false } = {}) {
  activeMapIdSignal.value = hasMap ? 'm-1' : null;
  mapsSignal.value = hasMap
    ? new Map([['m-1', { id: 'm-1', name: 'Battle Map', width_cells: 20, height_cells: 20, cell_px: 40 }]])
    : new Map();
  return /** @type {any} */ ({
    state: {
      isGM: () => isGM,
      maps: mapsSignal.value,
      map: hasMap ? mapsSignal.value.get('m-1') : null,
    },
    dismissMapHelp: () => {},
    openMapsPanel: () => {},
    zoomIn: () => {},
    zoomOut: () => {},
  });
}

describe('MapStrip - empty-state placeholder', () => {
  it('renders an empty-state hint when there is no active map', () => {
    const root = document.createElement('div');
    render(h(MapStrip, { ui: makeUi({ hasMap: false }) }), root);
    const empty = root.querySelector('.map-empty');
    expect(empty).toBeTruthy();
    expect(empty.textContent.toLowerCase()).toMatch(/no.*map|select.*map|waiting/);
  });

  it('does NOT render the placeholder when an active map is loaded', () => {
    const root = document.createElement('div');
    render(h(MapStrip, { ui: makeUi({ hasMap: true }) }), root);
    expect(root.querySelector('.map-empty')).toBeNull();
  });

  it('GM sees a "manage maps" CTA in the empty state', () => {
    const root = document.createElement('div');
    render(h(MapStrip, { ui: makeUi({ isGM: true, hasMap: false }) }), root);
    const btn = root.querySelector('.map-empty button');
    expect(btn).toBeTruthy();
    expect(btn.textContent.toLowerCase()).toMatch(/map/);
  });

  it('non-GM sees a "waiting for GM" hint without a CTA button', () => {
    const root = document.createElement('div');
    render(h(MapStrip, { ui: makeUi({ isGM: false, hasMap: false }) }), root);
    expect(root.querySelector('.map-empty button')).toBeNull();
    const empty = root.querySelector('.map-empty');
    expect(empty.textContent.toLowerCase()).toMatch(/gm|wait/);
  });
});
