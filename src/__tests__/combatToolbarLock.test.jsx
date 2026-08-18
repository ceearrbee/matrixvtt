/**
 * During combat the draw toolbar locks to Navigation. The lock must
 * not be silent (aria-disabled only): a visible note keeps users from
 * reading the dead group tabs as a bug.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, h } from 'preact';
import { MapStrip } from '../ui/MapStrip.jsx';
import { tablePhaseSignal, gmPrepActiveSignal } from '../state/ui-signals.js';
import { UI_MODES } from '../utils/constants.js';

function makeUi() {
  return /** @type {any} */ ({
    state: {
      isGM: () => true,
      tokens: new Map(),
      maps: new Map(),
      settings: { name: 'r', systemConfig: {}, gm_user_ids: ['@me:m'] },
      initiative: { active: true, round: 1, current_index: 0, order: [] },
      fog: { mode: null, revealed: [] },
    },
    widgetManager: { userId: '@me:m', roomId: '!r:m' },
  });
}

describe('combat toolbar lock note', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => {
    render(null, host);
    host.remove();
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    gmPrepActiveSignal.value = false;
  });

  it('shows a visible lock note during combat', () => {
    tablePhaseSignal.value = UI_MODES.COMBAT;
    gmPrepActiveSignal.value = false;
    render(h(MapStrip, { ui: makeUi() }), host);
    const note = host.querySelector('.draw-toolbar__lock-note');
    expect(note).not.toBeNull();
    expect(note.textContent).toMatch(/locked during combat/i);
  });

  it('shows no note outside combat', () => {
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    render(h(MapStrip, { ui: makeUi() }), host);
    expect(host.querySelector('.draw-toolbar__lock-note')).toBeNull();
  });

  it('shows no note when GM prep overrides combat', () => {
    tablePhaseSignal.value = UI_MODES.COMBAT;
    gmPrepActiveSignal.value = true;
    render(h(MapStrip, { ui: makeUi() }), host);
    expect(host.querySelector('.draw-toolbar__lock-note')).toBeNull();
  });
});
