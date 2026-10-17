/**
 * Bulk-destructive actions must go through the shared confirm dialog:
 * "Clear all drawings" was a one-click irreversible wipe sitting next
 * to single-stroke tools, and page deletion used window.confirm.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { MapStrip } from '../ui/MapStrip.jsx';
import { attachDataMethods } from '../ui/data-wiring.js';
import { tablePhaseSignal, gmPrepActiveSignal, activeToolGroupSignal } from '../state/ui-signals.js';
import { UI_MODES, TOOL_GROUPS } from '../utils/constants.js';
import { closeAllModals } from '../utils/modal-helpers.js';
import { loadTestMap } from './helpers/loadedMap.js';

function mkUi({ isGM = true } = {}) {
  return /** @type {any} */ ({
    state: { isGM: () => isGM, map: loadTestMap() },
    pingLocation: () => {},
    setDrawTool: () => {},
    setDrawColor: () => {},
    setDrawWidth: () => {},
    undoDrawing: () => {},
    redoDrawing: () => {},
    clearDrawings: vi.fn(),
    dismissMapHelp: () => {},
  });
}

beforeEach(() => {
  tablePhaseSignal.value = UI_MODES.NARRATIVE;
  gmPrepActiveSignal.value = false;
  activeToolGroupSignal.value = TOOL_GROUPS.DRAWING;
});

afterEach(() => {
  cleanup();
  closeAllModals();
  tablePhaseSignal.value = UI_MODES.NARRATIVE;
  gmPrepActiveSignal.value = false;
  activeToolGroupSignal.value = TOOL_GROUPS.NAVIGATION;
});

describe('clear all drawings', () => {
  it('asks for confirmation before wiping', async () => {
    activeToolGroupSignal.value = TOOL_GROUPS.DRAWING;
    const ui = mkUi();
    const { container } = render(h(MapStrip, { ui }));
    // Clear lives behind the toolbar's ⋯ overflow with undo and redo.
    fireEvent.click(container.querySelector('[data-map-overflow]'));
    const btn = container.querySelector('#clear-drawings');
    expect(btn).toBeTruthy();

    btn.click();
    expect(ui.clearDrawings).not.toHaveBeenCalled();

    const confirmBtn = document.querySelector('[data-confirm]');
    expect(confirmBtn).toBeTruthy();
    expect(confirmBtn.className).toMatch(/dbt--danger/);
    confirmBtn.click();
    expect(ui.clearDrawings).toHaveBeenCalledTimes(1);
  });
});

describe('page deletion', () => {
  it('routes through the confirm dialog, never window.confirm', async () => {
    const confirmSpy = vi.fn().mockReturnValue(true);
    const originalConfirm = window.confirm;
    window.confirm = confirmSpy;
    const ui = /** @type {any} */ ({
      state: {
        pages: new Map([['p1', { id: 'p1', visibility: 'gm' }]]),
        deletePage: vi.fn().mockResolvedValue(undefined),
      },
    });
    attachDataMethods(ui);

    ui.deletePage('p1');
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(ui.state.deletePage).not.toHaveBeenCalled();

    const confirmBtn = document.querySelector('[data-confirm]');
    expect(confirmBtn).toBeTruthy();
    confirmBtn.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(ui.state.deletePage).toHaveBeenCalledWith('p1');
    window.confirm = originalConfirm;
  });
});
