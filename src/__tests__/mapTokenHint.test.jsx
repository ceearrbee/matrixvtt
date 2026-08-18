/**
 * Teaching empty state: a map with no tokens shows the GM an inline
 * cue pointing at the Scene toolbar and right-click, instead of a
 * blank canvas (NN/g empty-state pattern).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, h } from 'preact';
import { MapStrip } from '../ui/MapStrip.jsx';
import { activeMapIdSignal, tokensSignal } from '../state/signals.js';
import { tablePhaseSignal, gmPrepActiveSignal } from '../state/ui-signals.js';
import { UI_MODES } from '../utils/constants.js';

const MAP = { id: 'map-1', cell_px: 40, width_cells: 20, height_cells: 20 };

function makeUi({ isGM = true, tokens = new Map() } = {}) {
  return /** @type {any} */ ({
    state: {
      isGM: () => isGM,
      tokens,
      map: MAP,
      maps: new Map([[MAP.id, MAP]]),
      settings: { name: 'r', systemConfig: {}, gm_user_ids: isGM ? ['@me:m'] : [] },
      initiative: { active: false, round: 0, current_index: 0, order: [] },
      fog: { mode: null, revealed: [] },
    },
    widgetManager: { userId: '@me:m', roomId: '!r:m' },
  });
}

describe('map token teaching hint', () => {
  let host;
  beforeEach(() => {
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    gmPrepActiveSignal.value = false;
    activeMapIdSignal.value = MAP.id;
    tokensSignal.value = new Map();
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => {
    render(null, host);
    host.remove();
    activeMapIdSignal.value = null;
    tokensSignal.value = new Map();
  });

  it('shows the cue to a GM when the active map has no tokens', () => {
    render(h(MapStrip, { ui: makeUi() }), host);
    const hint = host.querySelector('.map-hint');
    expect(hint).not.toBeNull();
    expect(hint.textContent).toMatch(/token/i);
  });

  it('hides the cue once a token exists on the map', () => {
    const tokens = new Map([['t1', { id: 't1', map_id: MAP.id, col: 1, row: 1 }]]);
    tokensSignal.value = tokens;
    render(h(MapStrip, { ui: makeUi({ tokens }) }), host);
    expect(host.querySelector('.map-hint')).toBeNull();
  });

  it('never shows the cue to players', () => {
    render(h(MapStrip, { ui: makeUi({ isGM: false }) }), host);
    expect(host.querySelector('.map-hint')).toBeNull();
  });
});
