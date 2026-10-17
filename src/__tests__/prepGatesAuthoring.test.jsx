/**
 * PRODUCT.md principle 5, executed: "GM power tools are disclosed on
 * intent, not fanned out permanently." With Prep off, a GM sees what a
 * player sees plus fog and initiative; the scene-building tools and the
 * create/GM-tools entries appear when they turn Prep on.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { render as prender, h } from 'preact';
import { Header } from '../ui/Header.jsx';
import { MapStrip } from '../ui/MapStrip.jsx';
import { settingsSignal, initiativeSignal, roomMembersSignal } from '../state/signals.js';
import { tablePhaseSignal, gmPrepActiveSignal, activeToolGroupSignal } from '../state/ui-signals.js';
import { UI_MODES, TOOL_GROUPS } from '../utils/constants.js';
import { loadTestMap } from './helpers/loadedMap.js';

function makeUi({ isGM = true } = {}) {
  return /** @type {any} */ ({
    state: {
      isGM: () => isGM,
      tokens: new Map(), maps: new Map(),
      map: loadTestMap(),
      roomMembers: [],
      settings: { name: 'r', systemConfig: {}, gm_user_ids: isGM ? ['@me:m'] : [] },
      initiative: { active: false, round: 0, current_index: 0, order: [] },
      fog: { mode: null, revealed: [] },
    },
    widgetManager: { userId: '@me:m', roomId: '!r:m', canLeave: false },
  });
}

beforeEach(() => {
  localStorage.clear();
  settingsSignal.value = { name: 'r', systemConfig: {}, gm_user_ids: [] };
  initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
  roomMembersSignal.value = [];
  tablePhaseSignal.value = UI_MODES.NARRATIVE;
  gmPrepActiveSignal.value = false;
  activeToolGroupSignal.value = TOOL_GROUPS.NAVIGATION;
});

describe('header authoring entries follow Prep', () => {
  afterEach(cleanup);

  it('hides Create-new and GM tools while Prep is off', () => {
    const { container } = render(h(Header, { ui: makeUi() }));
    expect(container.querySelector('#new-entity-btn')).toBeNull();
    expect(container.querySelector('#gm-controls-btn')).toBeNull();
  });

  it('shows them once Prep is on', () => {
    gmPrepActiveSignal.value = true;
    const { container } = render(h(Header, { ui: makeUi() }));
    expect(container.querySelector('#new-entity-btn')).not.toBeNull();
    expect(container.querySelector('#gm-controls-btn')).not.toBeNull();
  });

  it('keeps the Prep toggle itself always reachable for a GM', () => {
    const { container } = render(h(Header, { ui: makeUi() }));
    expect(container.querySelector('#gm-prep-btn')).not.toBeNull();
  });
});

describe('map Scene tool group follows Prep', () => {
  let host;
  beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });
  afterEach(() => { prender(null, host); host.remove(); });

  it('offers only Nav and Draw while Prep is off', () => {
    prender(h(MapStrip, { ui: makeUi() }), host);
    const groups = [...host.querySelectorAll('[data-tool-group]')].map((b) => b.getAttribute('data-tool-group'));
    expect(groups).toEqual([TOOL_GROUPS.NAVIGATION, TOOL_GROUPS.DRAWING]);
  });

  it('adds the Scene group once Prep is on', () => {
    gmPrepActiveSignal.value = true;
    prender(h(MapStrip, { ui: makeUi() }), host);
    const groups = [...host.querySelectorAll('[data-tool-group]')].map((b) => b.getAttribute('data-tool-group'));
    expect(groups).toContain(TOOL_GROUPS.GM);
  });

  it('falls back to Nav when Prep turns off while the Scene group is selected', () => {
    gmPrepActiveSignal.value = true;
    activeToolGroupSignal.value = TOOL_GROUPS.GM;
    prender(h(MapStrip, { ui: makeUi() }), host);
    gmPrepActiveSignal.value = false;
    prender(h(MapStrip, { ui: makeUi({ isGM: true }) }), host);
    expect(host.querySelector('[data-scene-action="add-token"]')).toBeNull();
    expect(host.querySelector('.dtb-group--active').getAttribute('data-tool-group'))
      .toBe(TOOL_GROUPS.NAVIGATION);
  });

  it('allows selecting Draw group during combat without Prep', () => {
    tablePhaseSignal.value = UI_MODES.COMBAT;
    gmPrepActiveSignal.value = false;
    activeToolGroupSignal.value = TOOL_GROUPS.DRAWING;
    prender(h(MapStrip, { ui: makeUi() }), host);
    const activeTab = host.querySelector('.dtb-group--active');
    expect(activeTab?.getAttribute('data-tool-group')).toBe(TOOL_GROUPS.DRAWING);
  });
});
