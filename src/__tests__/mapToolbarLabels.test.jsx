/**
 * Map toolbar discoverability contract. The toolbar is a compact
 * floating vertical strip (tldraw / Figma convention), so tools are
 * icon + tooltip rather than icon + always-on label: a stacked visible
 * label multiplies the strip's height until it overflows the map and
 * covers the header (regression fixed 2026-07-03). Each tool must
 * still carry an accessible name and a tooltip, and the strip must
 * stay bounded to the map region.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, h } from 'preact';
import { MapStrip } from '../ui/MapStrip.jsx';
import { tablePhaseSignal, gmPrepActiveSignal } from '../state/ui-signals.js';
import { UI_MODES } from '../utils/constants.js';

function makeUi({ isGM = true } = {}) {
  return /** @type {any} */ ({
    state: {
      isGM: () => isGM,
      tokens: new Map(),
      maps: new Map(),
      settings: { name: 'r', systemConfig: {}, gm_user_ids: isGM ? ['@me:m'] : [] },
      initiative: { active: false, round: 0, current_index: 0, order: [] },
      fog: { mode: null, revealed: [] },
    },
    widgetManager: { userId: '@me:m', roomId: '!r:m' },
  });
}

describe('map toolbar discoverability', () => {
  let host;
  beforeEach(() => {
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    gmPrepActiveSignal.value = false;
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => { render(null, host); host.remove(); });

  it('every tool button has an accessible name and a tooltip', () => {
    render(h(MapStrip, { ui: makeUi() }), host);
    const buttons = host.querySelectorAll('.dtb-btn[data-tool]');
    expect(buttons.length).toBeGreaterThan(0);
    for (const btn of buttons) {
      expect(btn.getAttribute('aria-label'), `tool ${btn.dataset.tool} aria-label`).toBeTruthy();
      expect(btn.getAttribute('title'), `tool ${btn.dataset.tool} title`).toBeTruthy();
    }
  });

  it('keeps the strip compact: no always-on visible text labels', () => {
    render(h(MapStrip, { ui: makeUi() }), host);
    // The label lives in the tooltip / sr-only name, never as a visible
    // block that would grow the vertical strip past the map.
    expect(host.querySelector('.dtb-btn__label')).toBeNull();
  });

  it('tool tooltips carry the keyboard shortcut', () => {
    render(h(MapStrip, { ui: makeUi() }), host);
    // Pointer is in the default Nav group, so it always renders.
    const pointer = host.querySelector('.dtb-btn[data-tool="pointer"]');
    expect(pointer.getAttribute('title')).toMatch(/\(V\)/);
  });
});
