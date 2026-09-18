/**
 * Undo, redo and clear-all sat as three permanent buttons on a toolbar
 * the plan wants at about twelve controls. They are recovery actions,
 * not tools: one overflow holds them.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';
import { fireEvent } from '@testing-library/preact';
import { MapStrip } from '../ui/MapStrip.jsx';
import { tablePhaseSignal, gmPrepActiveSignal, activeToolGroupSignal } from '../state/ui-signals.js';
import { UI_MODES, TOOL_GROUPS } from '../utils/constants.js';
import { loadTestMap } from './helpers/loadedMap.js';

function makeUi() {
  return /** @type {any} */ ({
    state: {
      isGM: () => true, tokens: new Map(), maps: new Map(),
      map: loadTestMap(),
      settings: { name: 'r', systemConfig: {}, gm_user_ids: ['@me:m'] },
      initiative: { active: false, round: 0, current_index: 0, order: [] },
      fog: { mode: null, revealed: [] },
    },
    widgetManager: { userId: '@me:m', roomId: '!r:m' },
    undoDrawing: vi.fn(), redoDrawing: vi.fn(), clearDrawings: vi.fn(),
  });
}

describe('map toolbar overflow', () => {
  let host;
  beforeEach(() => {
    localStorage.clear();
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    gmPrepActiveSignal.value = false;
    activeToolGroupSignal.value = TOOL_GROUPS.NAVIGATION;
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => { render(null, host); host.remove(); });

  it('shows one overflow button instead of three recovery buttons', () => {
    render(h(MapStrip, { ui: makeUi() }), host);
    expect(host.querySelector('[data-action="undo-drawing"]')).toBeNull();
    expect(host.querySelector('[data-action="redo-drawing"]')).toBeNull();
    expect(host.querySelector('#clear-drawings')).toBeNull();
    expect(host.querySelector('[data-map-overflow]')).not.toBeNull();
  });

  it('opens the three actions on demand and wires them through', () => {
    const ui = makeUi();
    render(h(MapStrip, { ui }), host);
    fireEvent.click(host.querySelector('[data-map-overflow]'));
    fireEvent.click(host.querySelector('[data-action="undo-drawing"]'));
    expect(ui.undoDrawing).toHaveBeenCalled();
    fireEvent.click(host.querySelector('[data-action="redo-drawing"]'));
    expect(ui.redoDrawing).toHaveBeenCalled();
    expect(host.querySelector('#clear-drawings')).not.toBeNull();
  });

  it('marks the overflow as an expandable menu for screen readers', () => {
    render(h(MapStrip, { ui: makeUi() }), host);
    const btn = host.querySelector('[data-map-overflow]');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(host.querySelector('[data-map-overflow]').getAttribute('aria-expanded')).toBe('true');
  });
});
