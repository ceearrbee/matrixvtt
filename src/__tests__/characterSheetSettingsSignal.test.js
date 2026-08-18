/**
 * CharacterSheet / NPCSheet - must subscribe to settingsSignal so that
 * a late-arriving ruleset (cold-load: room sync delivers settings AFTER
 * the sheet first rendered) triggers a re-render with the now-populated
 * sections list. Without this subscription, sheets show only the entity
 * header and ownership controls (Bug B reported 2026-05-09).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, h } from 'preact';
import { settingsSignal, charactersSignal, tokensSignal, npcsSignal } from '../state/signals.js';
import { selectedCharacterIdSignal, selectedNPCIdSignal, tablePhaseSignal } from '../state/ui-signals.js';
import { UI_MODES } from '../utils/constants.js';
import { CharacterSheet } from '../ui/CharacterSheet.jsx';
import { NPCSheet } from '../ui/NPCSheet.jsx';

beforeEach(() => { tablePhaseSignal.value = UI_MODES.COMBAT; });

const RULESET_WITH_SECTIONS = {
  character_sheet: { sections: [{ kind: 'notes' }] },
  npc_sheet: { sections: [{ kind: 'notes' }] },
};

function mkUi({ characters = new Map(), npcs = new Map() } = {}) {
  return {
    state: {
      characters,
      npcs,
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
    unclaimCharacter: vi.fn(),
    claimCharacter: vi.fn(),
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('Sheet settingsSignal subscription', () => {
  beforeEach(() => {
    settingsSignal.value = {};
    charactersSignal.value = new Map();
    npcsSignal.value = new Map();
    tokensSignal.value = new Map();
    selectedCharacterIdSignal.value = null;
    selectedNPCIdSignal.value = null;
    document.body.innerHTML = '';
  });

  it('CharacterSheet rerenders sections when settingsSignal updates', async () => {
    const characters = new Map([
      ['pc-1', { id: 'pc-1', name: 'Aria', hp_current: 10, hp_max: 10 }],
    ]);
    charactersSignal.value = characters;
    selectedCharacterIdSignal.value = 'pc-1';

    const ui = mkUi({ characters });
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(h(CharacterSheet, { ui }), root);

    expect(root.querySelector('.char-sheet')).not.toBeNull();
    // Before settings arrive: only the private-notes section header is
    // present (PrivateNotes is rendered unconditionally), no
    // ruleset-driven Notes header.
    const headersPre = [...root.querySelectorAll('.section-header')]
      .map((el) => el.textContent);
    expect(headersPre.some((t) => t === 'Notes')).toBe(false);

    settingsSignal.value = { systemConfig: RULESET_WITH_SECTIONS };
    await flush();

    const headersPost = [...root.querySelectorAll('.section-header')]
      .map((el) => el.textContent);
    expect(headersPost.some((t) => t === 'Notes')).toBe(true);
  });

  it('NPCSheet rerenders sections when settingsSignal updates', async () => {
    const npcs = new Map([
      ['npc-1', { id: 'npc-1', name: 'Goblin', hp_current: 8, hp_max: 8 }],
    ]);
    npcsSignal.value = npcs;
    selectedNPCIdSignal.value = 'npc-1';

    const ui = mkUi({ npcs });
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(h(NPCSheet, { ui }), root);

    expect(root.querySelector('.npc-sheet')).not.toBeNull();
    const headersPre = [...root.querySelectorAll('.section-header')]
      .map((el) => el.textContent);
    expect(headersPre.some((t) => t === 'Notes')).toBe(false);

    settingsSignal.value = { systemConfig: RULESET_WITH_SECTIONS };
    await flush();

    const headersPost = [...root.querySelectorAll('.section-header')]
      .map((el) => el.textContent);
    expect(headersPost.some((t) => t === 'Notes')).toBe(true);
  });
});
