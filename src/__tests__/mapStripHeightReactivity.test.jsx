/**
 * MapStrip - collapse state reacts to the vtt-map-strip:* localStorage
 * subscription, including cross-tab StorageEvents.
 *
 * These tests used to assert an inline `--map-strip-height` variable.
 * No rule ever read it: the almanac lays the split out map-dominant in
 * CSS, so the strip's height never came from the stamp. Asserting the
 * variable is why the dead path stayed green for as long as it did.
 * Zero is the collapsed sentinel and is the only thing the stamp
 * decides, so that is what these assert now.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/preact';

vi.mock('../map-renderer.js', () => ({
  MapRenderer: class {
    constructor() {}
    render() {}
    destroy() {}
    setTool() {}
  },
}));

import { MapStrip } from '../ui/MapStrip.jsx';
import { activeMapIdSignal } from '../state/signals.js';

function makeUi() {
  return /** @type {any} */ ({
    state: {
      isGM: () => false,
      map: { tokens: new Map() },
    },
    widgetManager: { userId: '@u:s', roomId: '!r:s' },
  });
}

beforeEach(() => {
  localStorage.clear();
  activeMapIdSignal.value = 'map-1';
});

afterEach(() => { cleanup(); });

describe('MapStrip - vtt-map-strip subscription', () => {
  it('renders expanded when the stamp holds a height', () => {
    localStorage.setItem('vtt-map-strip:@u:s:!r:s', '320');
    const { container } = render(h(MapStrip, { ui: makeUi() }));
    const strip = container.querySelector('.map-strip');
    expect(strip).toBeTruthy();
    expect(strip.classList.contains('map-strip--collapsed')).toBe(false);
  });

  it('renders expanded when no stamp exists', () => {
    const { container } = render(h(MapStrip, { ui: makeUi() }));
    expect(container.querySelector('.map-strip').classList.contains('map-strip--collapsed')).toBe(false);
  });

  it('collapses when the stamp is 0', () => {
    localStorage.setItem('vtt-map-strip:@u:s:!r:s', '0');
    const { container } = render(h(MapStrip, { ui: makeUi() }));
    const strip = container.querySelector('.map-strip');
    expect(strip).toBeTruthy();
    expect(strip.classList.contains('map-strip--collapsed')).toBe(true);
  });

  it('carries no height variable, because no rule reads one', () => {
    localStorage.setItem('vtt-map-strip:@u:s:!r:s', '320');
    const { container } = render(h(MapStrip, { ui: makeUi() }));
    expect(container.querySelector('.map-strip').getAttribute('style') ?? '')
      .not.toContain('--map-strip-height');
  });

  it('the chevron toggle persists 0 when collapsing and a height when expanding', async () => {
    localStorage.setItem('vtt-map-strip:@u:s:!r:s', '300');
    const { container } = render(h(MapStrip, { ui: makeUi() }));

    const toggle = container.querySelector('.map-strip__collapse');
    expect(toggle).toBeTruthy();

    // First click collapses: stored value becomes "0".
    fireEvent.click(toggle);
    await waitFor(() => expect(localStorage.getItem('vtt-map-strip:@u:s:!r:s')).toBe('0'));

    // Second click expands again: any non-zero value means expanded.
    fireEvent.click(toggle);
    await waitFor(() => expect(localStorage.getItem('vtt-map-strip:@u:s:!r:s')).toBe('360'));
  });
});
