/**
 * A tablist may hold only tabs (axe aria-required-children, critical).
 * The companion's collapse button and the map toolbar's toggle each sat
 * inside one, which failed axe on every page with the shell up.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render as prender, h } from 'preact';
import { RightCompanion } from '../ui/RightCompanion.jsx';
import { MapStrip } from '../ui/MapStrip.jsx';
import {
  settingsSignal, initiativeSignal, charactersSignal, npcsSignal, tokensSignal, roomMembersSignal,
} from '../state/signals.js';
import {
  activeTabSignal, selectedCharacterIdSignal, selectedNPCIdSignal, tablePhaseSignal,
  gmPrepActiveSignal, activeToolGroupSignal, companionCollapsedSignal,
} from '../state/ui-signals.js';
import { TABS, UI_MODES, TOOL_GROUPS } from '../utils/constants.js';
import { loadTestMap } from './helpers/loadedMap.js';

const CHARACTER = { id: 'pc-1', name: 'Aria', hp_current: 5, hp_max: 5, ac: 12, speed: 30 };

function makeUi() {
  return /** @type {any} */ ({
    state: {
      isGM: () => true,
      characters: new Map([[CHARACTER.id, CHARACTER]]),
      npcs: new Map(), items: new Map(), tokens: new Map(), spells: new Map(), maps: new Map(),
      map: loadTestMap(),
      roomMembers: [],
      settings: { name: 'r', systemConfig: { spell_schools: [], skills: [] }, environment: {}, gm_user_ids: ['@a:hs'] },
      initiative: { active: false, round: 0, current_index: 0, order: [] },
      fog: { mode: null, revealed: [] },
      damageLog: [], selectedNPCId: null,
      getCurrentCharacter: () => CHARACTER,
      canEditEntity: () => true,
      hasTokenForSheet: () => false,
    },
    _isMyCombatTurn: () => false,
    switchTab: (t) => { activeTabSignal.value = t; },
    widgetManager: { userId: '@a:hs', roomId: '!r:hs', canLeave: false },
  });
}

function nonTabChildren(host) {
  return [...host.querySelectorAll('[role="tablist"]')]
    .flatMap((list) => [...list.children])
    .filter((child) => child.getAttribute('role') !== 'tab')
    .map((child) => child.outerHTML);
}

let host;
beforeEach(() => {
  localStorage.clear();
  settingsSignal.value = { systemConfig: { spell_schools: [], skills: [] } };
  initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
  charactersSignal.value = new Map([[CHARACTER.id, CHARACTER]]);
  npcsSignal.value = new Map();
  tokensSignal.value = new Map();
  roomMembersSignal.value = [];
  selectedCharacterIdSignal.value = CHARACTER.id;
  selectedNPCIdSignal.value = null;
  tablePhaseSignal.value = UI_MODES.NARRATIVE;
  gmPrepActiveSignal.value = false;
  activeToolGroupSignal.value = TOOL_GROUPS.NAVIGATION;
  companionCollapsedSignal.value = false;
  activeTabSignal.value = TABS.SHEET;
  host = document.createElement('div');
  document.body.appendChild(host);
});
afterEach(() => { prender(null, host); host.remove(); });

describe('tablists hold only tabs', () => {
  it('the companion keeps its collapse button outside its tablists', () => {
    prender(h(RightCompanion, { ui: makeUi() }), host);
    expect(host.querySelector('.ctab--collapse')).not.toBeNull();
    expect(nonTabChildren(host)).toEqual([]);
  });

  it('the map toolbar keeps its toggle outside the tool-group tablist', () => {
    prender(h(MapStrip, { ui: makeUi() }), host);
    expect(host.querySelector('#toggle-toolbar')).not.toBeNull();
    expect(nonTabChildren(host)).toEqual([]);
  });
});
