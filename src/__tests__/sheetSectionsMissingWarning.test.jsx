/**
 * Sheet sections missing-warning: a silent config-driven fallback
 * hides real misconfiguration. When the ruleset is loaded (`systemConfig`
 * truthy) but declares no `character_sheet.sections` / `npc_sheet.sections`,
 * the sheet must render a visible warning instead of going blank.
 * When the ruleset hasn't loaded yet (`systemConfig` is null/empty), no
 * warning - that's a transient bootstrap state.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, h } from 'preact';
import { settingsSignal, charactersSignal, tokensSignal, npcsSignal } from '../state/signals.js';
import {
  selectedCharacterIdSignal, selectedNPCIdSignal, tablePhaseSignal, selectedTokenSignal,
} from '../state/ui-signals.js';
import { UI_MODES } from '../utils/constants.js';
import { CharacterSheet } from '../ui/CharacterSheet.jsx';
import { NPCSheet } from '../ui/NPCSheet.jsx';

const WARNING_TITLE = 'No sheet sections declared';

function mkUi({ characters = new Map(), npcs = new Map() } = {}) {
  return {
    state: {
      characters, npcs,
      tokens: new Map(),
      get settings() { return settingsSignal.value; },
      get selectedNPCId() { return selectedNPCIdSignal.value; },
      get selectedCharacterId() { return selectedCharacterIdSignal.value; },
      isGM: () => false,
      canEditEntity: () => false,
      hasTokenForSheet: () => false,
      getCurrentCharacter() {
        const id = selectedCharacterIdSignal.value;
        return id ? characters.get(id) : null;
      },
      getCurrentCharacterId: () => selectedCharacterIdSignal.value,
      widgetManager: { userId: '@me:s' },
      clearSelectedNPC: () => {},
    },
    widgetManager: { userId: '@me:s' },
    unclaimCharacter: () => {},
    claimCharacter: () => {},
  };
}

function mountInto(root, vnode) {
  document.body.appendChild(root);
  render(vnode, root);
}

describe('Sheet missing-sections warning', () => {
  beforeEach(() => {
    settingsSignal.value = {};
    charactersSignal.value = new Map();
    npcsSignal.value = new Map();
    tokensSignal.value = new Map();
    selectedCharacterIdSignal.value = null;
    selectedNPCIdSignal.value = null;
    selectedTokenSignal.value = null;
    tablePhaseSignal.value = UI_MODES.COMBAT;
    document.body.innerHTML = '';
  });

  it('CharacterSheet: no warning while ruleset is still loading (systemConfig absent)', () => {
    const characters = new Map([['pc-1', { id: 'pc-1', name: 'Aria' }]]);
    charactersSignal.value = characters;
    selectedCharacterIdSignal.value = 'pc-1';
    // systemConfig is undefined - bootstrap state.
    settingsSignal.value = {};

    const root = document.createElement('div');
    mountInto(root, h(CharacterSheet, { ui: mkUi({ characters }) }));

    expect(root.textContent).not.toContain(WARNING_TITLE);
  });

  it('CharacterSheet: shows warning when ruleset loaded but sections missing', () => {
    const characters = new Map([['pc-1', { id: 'pc-1', name: 'Aria' }]]);
    charactersSignal.value = characters;
    selectedCharacterIdSignal.value = 'pc-1';
    settingsSignal.value = { systemConfig: { character_sheet: {} } };

    const root = document.createElement('div');
    mountInto(root, h(CharacterSheet, { ui: mkUi({ characters }) }));

    expect(root.textContent).toContain(WARNING_TITLE);
  });

  it('NPCSheet: inherits character_sheet.sections, no warning', () => {
    const npcs = new Map([['npc-1', { id: 'npc-1', name: 'Goblin' }]]);
    npcsSignal.value = npcs;
    selectedNPCIdSignal.value = 'npc-1';
    settingsSignal.value = {
      systemConfig: { character_sheet: { sections: [{ kind: 'notes' }] } },
    };

    const root = document.createElement('div');
    mountInto(root, h(NPCSheet, { ui: mkUi({ npcs }) }));

    expect(root.textContent).not.toContain(WARNING_TITLE);
  });

  it('NPCSheet: warns when both npc_sheet and character_sheet sections are missing', () => {
    const npcs = new Map([['npc-1', { id: 'npc-1', name: 'Goblin' }]]);
    npcsSignal.value = npcs;
    selectedNPCIdSignal.value = 'npc-1';
    settingsSignal.value = {
      systemConfig: { npc_sheet: {}, character_sheet: {} },
    };

    const root = document.createElement('div');
    mountInto(root, h(NPCSheet, { ui: mkUi({ npcs }) }));

    expect(root.textContent).toContain(WARNING_TITLE);
  });
});
