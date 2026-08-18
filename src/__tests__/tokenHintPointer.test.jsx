/**
 * The empty-map token hint told touch users to right-click; long-press
 * has existed in the input layer all along but was never mentioned.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup } from '@testing-library/preact';
import { tablePhaseSignal, gmPrepActiveSignal, activeToolGroupSignal } from '../state/ui-signals.js';
import { activeMapIdSignal, tokensSignal } from '../state/signals.js';
import { UI_MODES, TOOL_GROUPS } from '../utils/constants.js';

vi.mock('../utils/pointer.js', () => ({ isCoarsePointer: vi.fn(() => true) }));

import { MapStrip } from '../ui/MapStrip.jsx';
import { isCoarsePointer } from '../utils/pointer.js';

function mkUi() {
  return /** @type {any} */ ({
    state: { isGM: () => true, map: { id: 'm1', width: 10, height: 10 }, tokens: new Map() },
    pingLocation: () => {}, setDrawTool: () => {}, setDrawColor: () => {},
    setDrawWidth: () => {}, undoDrawing: () => {}, redoDrawing: () => {},
    clearDrawings: () => {}, dismissMapHelp: () => {},
  });
}

beforeEach(() => {
  tablePhaseSignal.value = UI_MODES.NARRATIVE;
  gmPrepActiveSignal.value = false;
  activeToolGroupSignal.value = TOOL_GROUPS.NAVIGATION;
  activeMapIdSignal.value = 'm1';
  tokensSignal.value = new Map();
});
afterEach(() => {
  cleanup();
  activeMapIdSignal.value = null;
});

describe('token hint pointer copy', () => {
  it('touch users are told to long-press, not right-click', () => {
    vi.mocked(isCoarsePointer).mockReturnValue(true);
    const { container } = render(h(MapStrip, { ui: mkUi() }));
    const hint = container.querySelector('.map-hint');
    expect(hint).toBeTruthy();
    expect(hint.textContent).toMatch(/long-press/i);
    expect(hint.textContent).not.toMatch(/right-click/i);
  });

  it('mouse users keep the right-click copy', () => {
    vi.mocked(isCoarsePointer).mockReturnValue(false);
    const { container } = render(h(MapStrip, { ui: mkUi() }));
    const hint = container.querySelector('.map-hint');
    expect(hint).toBeTruthy();
    expect(hint.textContent).toMatch(/right-click/i);
  });
});
