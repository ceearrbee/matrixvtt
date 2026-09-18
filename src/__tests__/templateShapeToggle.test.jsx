/**
 * The cone is a shape of the existing template control, not a tenth
 * toolbar button: clicking the template button while a template shape
 * is already active swaps circle <-> cone.
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
      isGM: () => true,
      tokens: new Map(),
      maps: new Map(),
      map: loadTestMap(),
      settings: { name: 'r', systemConfig: {}, gm_user_ids: ['@me:m'] },
      initiative: { active: false, round: 0, current_index: 0, order: [] },
      fog: { mode: null, revealed: [] },
    },
    widgetManager: { userId: '@me:m', roomId: '!r:m' },
    setDrawTool: vi.fn(),
  });
}

function templateButton(host) {
  return host.querySelector('.dtb-btn[data-tool^="template-"]');
}

describe('template shape toggle', () => {
  let host;
  beforeEach(() => {
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    gmPrepActiveSignal.value = true;
    activeToolGroupSignal.value = TOOL_GROUPS.GM;
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => {
    render(null, host);
    host.remove();
    activeToolGroupSignal.value = TOOL_GROUPS.NAVIGATION;
    gmPrepActiveSignal.value = false;
  });

  it('adds no second button for the cone', () => {
    render(h(MapStrip, { ui: makeUi() }), host);
    expect(host.querySelectorAll('.dtb-btn[data-tool^="template-"]').length).toBe(1);
  });

  it('selects the circle template first', () => {
    const ui = makeUi();
    render(h(MapStrip, { ui }), host);
    fireEvent.click(templateButton(host));
    expect(ui.setDrawTool).toHaveBeenLastCalledWith('template-circle');
  });

  it('swaps to the cone on a second click and back on a third', () => {
    const ui = makeUi();
    render(h(MapStrip, { ui }), host);
    fireEvent.click(templateButton(host));
    fireEvent.click(templateButton(host));
    expect(ui.setDrawTool).toHaveBeenLastCalledWith('template-cone');
    fireEvent.click(templateButton(host));
    expect(ui.setDrawTool).toHaveBeenLastCalledWith('template-circle');
  });

  it('names the active shape in the accessible label', () => {
    const ui = makeUi();
    render(h(MapStrip, { ui }), host);
    fireEvent.click(templateButton(host));
    expect(templateButton(host).getAttribute('aria-label')).toMatch(/circle/i);
    fireEvent.click(templateButton(host));
    expect(templateButton(host).getAttribute('aria-label')).toMatch(/cone/i);
  });
});
