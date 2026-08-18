/**
 * TRUE end-to-end: render CharacterSheet, call showCharacterPreview
 * (production code), click the actual View Full Sheet button, assert
 * the CharacterSheet renders the character.
 *
 * If this passes, the production code path is correct top-to-bottom
 * and any user-visible "doesn't work" is environmental (stale
 * service worker, cached bundle, widget URL pointing at pre-fix build).
 * If it fails, there's a real bug to fix.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, h } from 'preact';
import { CharacterSheet } from '../ui/CharacterSheet.jsx';
import { showCharacterPreview, showNPCPreview } from '../ui/preview/preview-modals.js';
import { NPCSheet } from '../ui/NPCSheet.jsx';
import {
  selectedCharacterIdSignal, selectedNPCIdSignal, selectedTokenSignal,
} from '../state/ui-signals.js';
import {
  charactersSignal, npcsSignal, tokensSignal, settingsSignal,
  itemsSignal, spellsSignal,
} from '../state/signals.js';

async function flush() { await Promise.resolve(); await Promise.resolve(); }

function mount(vnode) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  render(vnode, root);
  return root;
}

const aria = { id: 'chr-aria', name: 'Aria Blackwood', type: 'pc', attributes: {} };
const goblin = { id: 'npc-gob', name: 'Goblin', type: 'npc', attributes: {} };
const ariaToken = { id: 'tok-aria', sheet_id: 'chr-aria', type: 'pc' };
const gobToken  = { id: 'tok-gob',  sheet_id: 'npc-gob',  type: 'npc' };

function makeUi({ characters, npcs = new Map(), tokens = new Map() }) {
  charactersSignal.value = characters;
  npcsSignal.value = npcs;
  tokensSignal.value = tokens;
  const systemConfig = {
    character_sheet: { sections: [] },
    npc_sheet:       { sections: [] },
    character_preview: { sections: [] },
    npc_preview: { sections: [] },
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

  const ui = {
    state,
    widgetManager: { userId: '@me:hs' },
    mapRenderer: null,
    chat: { announceMessage: vi.fn() },
    switchTab: vi.fn(),
    claimCharacter: vi.fn(),
    unclaimCharacter: vi.fn(),
    showEditCharacterForm: vi.fn(),
    saveCharacterAsTemplate: vi.fn(),
    placeSheetOnMap: vi.fn(),
    showEntityForm: vi.fn(),
    clearSelectedNPC: () => { selectedNPCIdSignal.value = null; },
  };
  // Wire selectCharacterById / selectNPCById to mirror what
  // src/ui/entity/selection.js _selectEntity does - without dragging
  // in the full module graph.
  ui.selectCharacterById = (id) => {
    if (!state.characters.has(id)) return;
    state.selectedCharacterId = id;
    for (const [tid, t] of state.tokens.entries()) {
      if (t.sheet_id === id) { state.selectedToken = tid; break; }
    }
    ui.switchTab('sheet');
  };
  ui.selectNPCById = (id) => {
    if (!state.npcs.has(id)) return;
    state.selectedNPCId = id;
    for (const [tid, t] of state.tokens.entries()) {
      if (t.sheet_id === id) { state.selectedToken = tid; break; }
    }
    ui.switchTab('npc');
  };
  return ui;
}

beforeEach(() => {
  selectedCharacterIdSignal.value = null;
  selectedNPCIdSignal.value = null;
  selectedTokenSignal.value = null;
  document.body.innerHTML = '';
});

describe('end-to-end: preview modal → View Full Sheet → sheet rendered', () => {
  it('character: clicking the actual rendered button updates the panel', async () => {
    const characters = new Map([['chr-aria', aria]]);
    const tokens = new Map([['tok-aria', ariaToken]]);
    const ui = makeUi({ characters, tokens });

    // Mount the sheet panel with no current selection - should show EntityList.
    const sheetRoot = mount(h(CharacterSheet, { ui }));
    expect(sheetRoot.querySelector('.char-sheet-empty')).toBeTruthy();

    // Open the preview modal via the production helper.
    showCharacterPreview(ui, 'chr-aria');

    const modal = document.getElementById('preview-modal');
    expect(modal, 'preview modal must mount').toBeTruthy();

    // Find the actual rendered View Full Sheet button.
    const buttons = [...modal.querySelectorAll('button')];
    const viewBtn = buttons.find((b) => b.textContent.trim() === 'View Full Sheet');
    expect(viewBtn, 'View Full Sheet button must render').toBeTruthy();

    // Click it - same path the user clicks.
    viewBtn.click();
    await flush();

    // Modal must be gone.
    expect(document.getElementById('preview-modal')).toBeNull();
    // Sheet panel must now show the character.
    expect(sheetRoot.querySelector('.char-sheet-empty')).toBeNull();
    const sheet = sheetRoot.querySelector('.char-sheet[data-entity-id="chr-aria"]');
    expect(sheet, 'CharacterSheet must render with the selected character after the click').toBeTruthy();
  });

  it('NPC: clicking the actual rendered button updates the NPC panel', async () => {
    const npcs = new Map([['npc-gob', goblin]]);
    const tokens = new Map([['tok-gob', gobToken]]);
    const ui = makeUi({ characters: new Map(), npcs, tokens });

    const sheetRoot = mount(h(NPCSheet, { ui }));
    expect(sheetRoot.querySelector('.npc-sheet[data-entity-id]')).toBeNull();

    showNPCPreview(ui, 'npc-gob');
    const modal = document.getElementById('preview-modal');
    expect(modal).toBeTruthy();

    const buttons = [...modal.querySelectorAll('button')];
    const viewBtn = buttons.find((b) => b.textContent.trim() === 'View Full Sheet');
    viewBtn.click();
    await flush();

    expect(document.getElementById('preview-modal')).toBeNull();
    const sheet = sheetRoot.querySelector('.npc-sheet[data-entity-id="npc-gob"]');
    expect(sheet, 'NPCSheet must render with the selected NPC').toBeTruthy();
  });
});
