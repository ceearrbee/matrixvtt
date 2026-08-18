/**
 * The toolbar's GM group is the Scene group: one labeled home for the
 * scene-prep tools (walls, lights, templates) plus the add-token and
 * fog area actions, so none of them hide behind right-click only.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';
import { fireEvent } from '@testing-library/preact';
import { MapStrip } from '../ui/MapStrip.jsx';
import { tablePhaseSignal, gmPrepActiveSignal, activeToolGroupSignal } from '../state/ui-signals.js';
import { UI_MODES, TOOL_GROUPS } from '../utils/constants.js';

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
    beginTokenPlacement: vi.fn(),
    revealFogArea: vi.fn(),
    hideFogArea: vi.fn(),
  });
}

describe('map toolbar Scene group', () => {
  let host;
  beforeEach(() => {
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    gmPrepActiveSignal.value = false;
    activeToolGroupSignal.value = TOOL_GROUPS.GM;
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => {
    render(null, host);
    host.remove();
    activeToolGroupSignal.value = TOOL_GROUPS.NAVIGATION;
  });

  it('labels the GM group tab "Scene"', () => {
    render(h(MapStrip, { ui: makeUi() }), host);
    expect(host.querySelector('[data-tool-group="gm"]').textContent).toBe('Scene');
  });

  it('offers the light tool alongside walls and templates', () => {
    render(h(MapStrip, { ui: makeUi() }), host);
    for (const tool of ['wall', 'light', 'template-circle']) {
      expect(host.querySelector(`.dtb-btn[data-tool="${tool}"]`), tool).not.toBeNull();
    }
  });

  it('offers add-token and fog area actions, wired to the ui delegates', () => {
    const ui = makeUi();
    render(h(MapStrip, { ui }), host);
    fireEvent.click(host.querySelector('[data-scene-action="add-token"]'));
    expect(ui.beginTokenPlacement).toHaveBeenCalled();
    fireEvent.click(host.querySelector('[data-scene-action="reveal-fog"]'));
    expect(ui.revealFogArea).toHaveBeenCalled();
    fireEvent.click(host.querySelector('[data-scene-action="hide-fog"]'));
    expect(ui.hideFogArea).toHaveBeenCalled();
  });

  it('renders none of it for players', () => {
    activeToolGroupSignal.value = TOOL_GROUPS.NAVIGATION;
    render(h(MapStrip, { ui: makeUi({ isGM: false }) }), host);
    expect(host.querySelector('[data-tool-group="gm"]')).toBeNull();
    expect(host.querySelector('[data-scene-action]')).toBeNull();
  });
});
