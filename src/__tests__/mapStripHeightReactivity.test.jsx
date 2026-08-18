/**
 * MapStrip - height reacts to the vtt-map-strip:* localStorage
 * subscription, including cross-tab StorageEvents.
 *
 * Pairs with mapStripSize.test.js (the helper-level tests): the writer
 * was tested but the consumer component's reactive re-render wasn't.
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
  it('uses the stored height as the inline --map-strip-height variable on mount', () => {
    localStorage.setItem('vtt-map-strip:@u:s:!r:s', '320');
    const { container } = render(h(MapStrip, { ui: makeUi() }));
    const strip = container.querySelector('.map-strip');
    expect(strip).toBeTruthy();
    expect(strip.getAttribute('style')).toMatch(/--map-strip-height:\s*320px/);
  });

  it('falls back to the 360px default when no stamp exists', () => {
    const { container } = render(h(MapStrip, { ui: makeUi() }));
    const strip = container.querySelector('.map-strip');
    expect(strip.getAttribute('style')).toMatch(/--map-strip-height:\s*360px/);
  });

  it('collapses to the chrome height when the stamp is 0', () => {
    localStorage.setItem('vtt-map-strip:@u:s:!r:s', '0');
    const { container } = render(h(MapStrip, { ui: makeUi() }));
    const strip = container.querySelector('.map-strip');
    expect(strip).toBeTruthy();
    // collapsed sentinel renders the 32px chrome band.
    expect(strip.getAttribute('style')).toMatch(/--map-strip-height:\s*32px/);
    expect(strip.classList.contains('map-strip--collapsed')).toBe(true);
  });

  it('the chevron toggle persists 0 when collapsing and restores the last expanded value', async () => {
    localStorage.setItem('vtt-map-strip:@u:s:!r:s', '300');
    const { container } = render(h(MapStrip, { ui: makeUi() }));

    const toggle = container.querySelector('.map-strip__collapse');
    expect(toggle).toBeTruthy();

    // First click collapses: stored value becomes "0".
    fireEvent.click(toggle);
    await waitFor(() => expect(localStorage.getItem('vtt-map-strip:@u:s:!r:s')).toBe('0'));

    // Second click expands: restored to the last expanded height.
    fireEvent.click(toggle);
    await waitFor(() => expect(localStorage.getItem('vtt-map-strip:@u:s:!r:s')).toBe('300'));
  });
});
