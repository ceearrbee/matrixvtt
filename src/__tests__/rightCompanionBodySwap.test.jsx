/**
 * RightCompanion - tab bodies actually render (not just the tab chrome).
 *
 * `rightCompanion.test.jsx` covers tab presence/gating/switchTab wiring; this
 * proves that driving `activeTabSignal` mounts the matching body and that the
 * body renders identifiable content from seeded state - so the routing is
 * verified end-to-end, not just that `switchTab` was called.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup } from '@testing-library/preact';
import { RightCompanion } from '../ui/RightCompanion.jsx';
import {
  settingsSignal, initiativeSignal, charactersSignal, npcsSignal, tokensSignal,
} from '../state/signals.js';
import {
  activeTabSignal, selectedCharacterIdSignal, selectedNPCIdSignal, tablePhaseSignal,
} from '../state/ui-signals.js';
import { TABS, UI_MODES } from '../utils/constants.js';

const CHARACTER = {
  id: 'pc-1', name: 'Aria Blackwood', race: 'Halfling', class_name: 'Rogue', level: 5,
  hp_current: 28, hp_max: 40, ac: 15, speed: 30,
};
const NPC = { id: 'npc-1', name: 'Orc Warlord', cr: 3, hp_current: 45, hp_max: 60, ac: 14 };

function makeUi() {
  return /** @type {any} */ ({
    state: {
      isGM: () => true,
      characters: new Map([[CHARACTER.id, CHARACTER]]),
      npcs: new Map([[NPC.id, NPC]]),
      items: new Map([['i-1', { id: 'i-1', name: 'Longsword', kind: 'weapon' }]]),
      tokens: new Map(),
      spells: new Map(),
      settings: { systemConfig: { spell_schools: [], skills: [], common_actions: [], play_actions: [] }, environment: {} },
      initiative: { active: false, round: 0, current_index: 0, order: [] },
      damageLog: [],
      selectedNPCId: null,
      getCurrentCharacter: () => CHARACTER,
      canEditEntity: () => true,
      hasTokenForSheet: () => false,
    },
    _isMyCombatTurn: () => false,
    switchTab: (t) => { activeTabSignal.value = t; },
  });
}

beforeEach(() => {
  settingsSignal.value = { systemConfig: { spell_schools: [], skills: [] } };
  initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
  charactersSignal.value = new Map([[CHARACTER.id, CHARACTER]]);
  npcsSignal.value = new Map([[NPC.id, NPC]]);
  tokensSignal.value = new Map();
  selectedCharacterIdSignal.value = CHARACTER.id;
  selectedNPCIdSignal.value = null;
  tablePhaseSignal.value = UI_MODES.NARRATIVE;
  activeTabSignal.value = TABS.SHEET;
});
afterEach(() => cleanup());

describe('RightCompanion body swap', () => {
  it('Sheet tab mounts the character sheet with the current character', () => {
    const { container } = render(h(RightCompanion, { ui: makeUi() }));
    expect(container.querySelector('.ctab[data-tab="sheet"].on')).not.toBeNull();
    expect(container.querySelector('.char-sheet')).not.toBeNull();
    expect(container.textContent).toContain('Aria Blackwood');
  });

  it('Combat tab mounts the tracker (round + combatant) when initiative is active', () => {
    const ui = makeUi();
    ui.state.initiative = {
      active: true, round: 2, current_index: 0,
      order: [{ token_id: 't1', name: 'Aria', hp_current: 28, hp_max: 40 }],
    };
    initiativeSignal.value = ui.state.initiative;
    activeTabSignal.value = TABS.COMBAT;
    const { container } = render(h(RightCompanion, { ui }));
    expect(container.querySelector('.ctab[data-tab="combat"]')).not.toBeNull();
    expect(container.textContent).toContain('Round 2');
    expect(container.textContent).toContain('Aria');
  });

  it('Party tab mounts the roster with party + NPC cards', () => {
    activeTabSignal.value = TABS.PARTY;
    const { container } = render(h(RightCompanion, { ui: makeUi() }));
    expect(container.querySelector('.ctab[data-tab="party"].on')).not.toBeNull();
    expect(container.querySelectorAll('.party-roster__card').length).toBeGreaterThan(0);
    expect(container.textContent).toContain('Aria Blackwood');
  });

  it('NPC tab mounts the selected NPC sheet', () => {
    const ui = makeUi();
    ui.state.selectedNPCId = NPC.id;
    selectedNPCIdSignal.value = NPC.id;
    activeTabSignal.value = TABS.NPC;
    const { container } = render(h(RightCompanion, { ui }));
    expect(container.querySelector('.ctab[data-tab="npc"].on')).not.toBeNull();
    expect(container.querySelector('.npc-sheet')).not.toBeNull();
    expect(container.textContent).toContain('Orc Warlord');
  });

  it('Items tab mounts its body without error', () => {
    activeTabSignal.value = TABS.ITEMS;
    const { container } = render(h(RightCompanion, { ui: makeUi() }));
    expect(container.querySelector('.ctab[data-tab="items"].on')).not.toBeNull();
    expect(container.querySelector('.cbody')).not.toBeNull();
  });
});
