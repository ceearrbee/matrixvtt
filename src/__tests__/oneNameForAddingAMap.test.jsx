/**
 * The two ways to add a map call it the same thing.
 *
 * A blank campaign's first screen showed a "Add a map" checklist chip
 * three lines above the empty canvas's "Open maps panel" button. Both
 * open the same panel; one named the job and the other named the
 * mechanism, so the reader had to work out whether they were the same
 * thing. The vocabulary gate exists for exactly this.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, h } from 'preact';
import { MapStrip } from '../ui/MapStrip.jsx';
import { nextStepsFor, NEXT_STEP_KEYS } from '../ui/next-steps.js';
import { activeMapIdSignal, mapsSignal, tokensSignal } from '../state/signals.js';

function makeUi() {
  activeMapIdSignal.value = null;
  mapsSignal.value = new Map();
  tokensSignal.value = new Map();
  return /** @type {any} */ ({
    state: {
      isGM: () => true, map: null, maps: new Map(), tokens: new Map(),
      settings: { name: 'r', systemConfig: {}, gm_user_ids: ['@me:m'] },
      initiative: { active: false, round: 0, current_index: 0, order: [] },
      fog: { mode: null, revealed: [] },
    },
    widgetManager: { userId: '@me:m', roomId: '!r:m' },
    openMapsPanel: vi.fn(),
  });
}

describe('one name for adding a map', () => {
  let host;
  beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });
  afterEach(() => { render(null, host); host.remove(); activeMapIdSignal.value = null; });

  it('the empty canvas asks for the same thing the checklist does', () => {
    const chip = nextStepsFor({
      isGM: true, memberCount: 1, maps: new Map(), tokens: new Map(),
      characters: new Map(), initiative: { active: false, order: [] }, myUserId: '@me:m',
    }).find((s) => s.key === NEXT_STEP_KEYS.MAP);

    render(h(MapStrip, { ui: makeUi() }), host);
    const cta = host.querySelector('.map-empty button');
    expect(cta.textContent.trim()).toBe(chip.label);
  });

  it('still opens the maps panel', () => {
    const ui = makeUi();
    render(h(MapStrip, { ui }), host);
    host.querySelector('.map-empty button').click();
    expect(ui.openMapsPanel).toHaveBeenCalled();
  });
});
