/**
 * Closes the gap between "selection signal writes work" (proven by
 * selectionSignals.test.js) and "user sees the sheet" (the actual
 * View-Full-Sheet bug). Renders the sheet components live, writes
 * the signals, asserts the component swaps from EntityList to the
 * full sheet view.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, h } from 'preact';

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function mount(vnode) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  render(vnode, root);
  return { container: root };
}
import { CharacterSheet } from '../ui/CharacterSheet.jsx';
import { NPCSheet } from '../ui/NPCSheet.jsx';
import {
  selectedCharacterIdSignal, selectedNPCIdSignal, selectedTokenSignal,
} from '../state/ui-signals.js';
import {
  charactersSignal, npcsSignal, tokensSignal, settingsSignal, itemsSignal, spellsSignal,
} from '../state/signals.js';

// Build a fixture that quacks like StateManager: signal-backed
// getters/setters for the three selection fields + reader semantics
// for getCurrentCharacter / getCurrentNPC.
function makeUi({ characters = new Map(), npcs = new Map(), tokens = new Map() } = {}) {
  // Seed the collection signals so the components' top-of-render
  // dereferences observe a non-empty Map. Same shape as production -
  // the components read both signal.value (subscribe) AND ui.state.*
  // (the live collection).
  charactersSignal.value = characters;
  npcsSignal.value = npcs;
  tokensSignal.value = tokens;
  const systemConfig = {
    character_sheet: { sections: [] },
    npc_sheet:       { sections: [] },
    attributes: [],
  };
  settingsSignal.value = { systemConfig };
  itemsSignal.value = new Map();
  spellsSignal.value = new Map();

  const state = {
    characters, npcs, tokens,
    items: new Map(), spells: new Map(),
    settings: { systemConfig },
    initiative: { active: false, order: [] },
    isGM: () => true,
    canEditEntity: () => true,
    hasTokenForSheet: () => false,
    getCurrentCharacter() {
      const tid = this.selectedToken;
      const tok = tid ? this.tokens.get(tid) : null;
      const id = tok?.sheet_id ?? this.selectedCharacterId;
      return id ? this.characters.get(id) ?? null : null;
    },
    getCurrentNPC() {
      const tid = this.selectedToken;
      const tok = tid ? this.tokens.get(tid) : null;
      if (tok?.type === 'npc' && tok.sheet_id) return this.npcs.get(tok.sheet_id) ?? null;
      const id = this.selectedNPCId;
      return id ? this.npcs.get(id) ?? null : null;
    },
    get selectedCharacterId() { return selectedCharacterIdSignal.value; },
    set selectedCharacterId(v) { selectedCharacterIdSignal.value = v; },
    get selectedNPCId() { return selectedNPCIdSignal.value; },
    set selectedNPCId(v) { selectedNPCIdSignal.value = v; },
    get selectedToken() { return selectedTokenSignal.value; },
    set selectedToken(v) { selectedTokenSignal.value = v; },
  };

  return {
    state,
    widgetManager: { userId: '@me:hs' },
    claimCharacter: vi.fn(),
    unclaimCharacter: vi.fn(),
    showEditCharacterForm: vi.fn(),
    saveCharacterAsTemplate: vi.fn(),
    placeSheetOnMap: vi.fn(),
    deleteCharacter: vi.fn(),
    showCharacterPreview: vi.fn(),
    showNPCPreview: vi.fn(),
    selectCharacterById: vi.fn(),
    selectNPCById: vi.fn(),
    showEntityForm: vi.fn(),
    deleteNPC: vi.fn(),
    clearSelectedNPC: () => { selectedNPCIdSignal.value = null; },
    rollSkillCheck: vi.fn(),
    _calcModifier: (v) => Math.floor((Number(v) - 10) / 2),
  };
}

const aria = { id: 'chr-aria', name: 'Aria Blackwood', type: 'pc', attributes: {} };
const goblin = { id: 'npc-gob', name: 'Goblin', type: 'npc', attributes: {} };
const ariaToken = { id: 'tok-aria', sheet_id: 'chr-aria', type: 'pc' };
const gobToken  = { id: 'tok-gob',  sheet_id: 'npc-gob',  type: 'npc' };

beforeEach(() => {
  selectedCharacterIdSignal.value = null;
  selectedNPCIdSignal.value = null;
  selectedTokenSignal.value = null;
  document.body.innerHTML = '';
});

describe('CharacterSheet swaps from EntityList to full sheet on selection', () => {
  it('initially mounts with no selection → EntityList visible, no sheet header', () => {
    const ui = makeUi({ characters: new Map([['chr-aria', aria]]) });
    const { container } = mount(h(CharacterSheet, { ui }));
    expect(container.querySelector('.char-sheet-empty')).toBeTruthy();
    expect(container.querySelector('.char-sheet[data-entity-id]')).toBeNull();
  });

  it('writing selectedCharacterIdSignal swaps to the full sheet branch', async () => {
    const ui = makeUi({ characters: new Map([['chr-aria', aria]]) });
    const { container } = mount(h(CharacterSheet, { ui }));
    expect(container.querySelector('.char-sheet-empty')).toBeTruthy();

    selectedCharacterIdSignal.value = 'chr-aria';
    await flush();

    expect(container.querySelector('.char-sheet-empty')).toBeNull();
    const sheet = container.querySelector('.char-sheet[data-entity-id="chr-aria"]');
    expect(sheet, 'CharacterSheet must re-render with chr-aria after the signal fires').toBeTruthy();
    expect(sheet.textContent).toMatch(/Aria Blackwood/);
  });

  it('clearing selectedCharacterIdSignal swaps back to EntityList', async () => {
    const ui = makeUi({ characters: new Map([['chr-aria', aria]]) });
    const { container } = mount(h(CharacterSheet, { ui }));
    selectedCharacterIdSignal.value = 'chr-aria';
    await flush();
    expect(container.querySelector('.char-sheet[data-entity-id]')).toBeTruthy();

    selectedCharacterIdSignal.value = null;
    await flush();
    expect(container.querySelector('.char-sheet-empty')).toBeTruthy();
    expect(container.querySelector('.char-sheet[data-entity-id]')).toBeNull();
  });

  it('writing selectedTokenSignal (map-click path) also swaps to the sheet branch', async () => {
    const ui = makeUi({
      characters: new Map([['chr-aria', aria]]),
      tokens: new Map([['tok-aria', ariaToken]]),
    });
    const { container } = mount(h(CharacterSheet, { ui }));
    selectedTokenSignal.value = 'tok-aria';
    await flush();
    const sheet = container.querySelector('.char-sheet[data-entity-id="chr-aria"]');
    expect(sheet, 'CharacterSheet must respond to selectedTokenSignal').toBeTruthy();
  });
});

describe('NPCSheet swaps from EntityList to full sheet on selection', () => {
  it('initially mounts with no selection → EntityList visible, no sheet', () => {
    const ui = makeUi({ npcs: new Map([['npc-gob', goblin]]) });
    const { container } = mount(h(NPCSheet, { ui }));
    expect(container.querySelector('.npc-sheet[data-entity-id]')).toBeNull();
  });

  it('writing selectedNPCIdSignal swaps to the full sheet branch', async () => {
    const ui = makeUi({ npcs: new Map([['npc-gob', goblin]]) });
    const { container } = mount(h(NPCSheet, { ui }));
    selectedNPCIdSignal.value = 'npc-gob';
    await flush();
    const sheet = container.querySelector('.npc-sheet[data-entity-id="npc-gob"]');
    expect(sheet, 'NPCSheet must re-render with npc-gob after the signal fires').toBeTruthy();
    expect(sheet.textContent).toMatch(/Goblin/);
  });

});

describe('Full preview-modal → "View Full Sheet" flow', () => {
  it('CharacterSheet renders the character after the full preview flow', async () => {
    // Wire selectCharacterById to fire signals like _selectEntity does:
    // selectedCharacterId + (when token exists) selectedToken.
    const characters = new Map([['chr-aria', aria]]);
    const tokens = new Map([['tok-aria', ariaToken]]);
    const ui = makeUi({ characters, tokens });
    ui.selectCharacterById = vi.fn((id) => {
      ui.state.selectedCharacterId = id;
      ui.state.selectedToken = 'tok-aria';
    });
    const { container } = mount(h(CharacterSheet, { ui }));

    // Simulate user clicking the "View Full Sheet" button:
    // it closes the preview modal (no-op here, no modal exists), then
    // calls ui.selectCharacterById(entity.id).
    ui.selectCharacterById('chr-aria');
    await flush();

    expect(container.querySelector('.char-sheet-empty')).toBeNull();
    const sheet = container.querySelector('.char-sheet[data-entity-id="chr-aria"]');
    expect(sheet).toBeTruthy();
    expect(sheet.textContent).toMatch(/Aria Blackwood/);
  });

  it('NPCSheet renders the NPC after the full preview flow', async () => {
    const npcs = new Map([['npc-gob', goblin]]);
    const tokens = new Map([['tok-gob', gobToken]]);
    const ui = makeUi({ npcs, tokens });
    ui.selectNPCById = vi.fn((id) => {
      ui.state.selectedNPCId = id;
      ui.state.selectedToken = 'tok-gob';
    });
    const { container } = mount(h(NPCSheet, { ui }));

    ui.selectNPCById('npc-gob');
    await flush();

    const sheet = container.querySelector('.npc-sheet[data-entity-id="npc-gob"]');
    expect(sheet).toBeTruthy();
    expect(sheet.textContent).toMatch(/Goblin/);
  });
});

