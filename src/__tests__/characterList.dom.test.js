/**
 * Character/NPC sheet DOM tests - Preact edition.
 *
 * Renders the live Preact components and asserts on the resulting DOM.
 * Replaces the legacy `ui.renderCharacterSheet()` / string-HTML suite
 * that targeted the deleted character-sheet.js.
 *
 * Empty-state and card-selection are covered by entityListPreact.test.js;
 * escape contracts by uiSecurity.test.js and characterSwitcherPreact.test.js.
 * This file focuses on the sheet-detail path: HP meter, claim/release,
 * missing fields, rendered attribute rows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/preact';
import { h } from 'preact';

import { CharacterSheet } from '../ui/CharacterSheet.jsx';
import { NPCSheet } from '../ui/NPCSheet.jsx';

function mkUi({ currentCharacter = null, currentNPC = null, isGM = false, userId = '@me:s', canEdit = false, systemConfig = null } = {}) {
  const state = {
    isGM: () => isGM,
    canEditEntity: () => canEdit,
    getCurrentCharacter: () => currentCharacter,
    getCurrentCharacterId: () => currentCharacter?.id ?? null,
    getCurrentNPC: () => currentNPC,
    getCurrentNPCId: () => currentNPC?.id ?? null,
    hasTokenForSheet: () => false,
    characters: new Map(currentCharacter ? [[currentCharacter.id, currentCharacter]] : []),
    npcs: new Map(currentNPC ? [[currentNPC.id, currentNPC]] : []),
    items: new Map(),
    spells: new Map(),
    tokens: new Map(),
    selectedNPCId: currentNPC?.id ?? null,
    settings: { systemConfig, gm_user_ids: isGM ? [userId] : [] },
  };
  return {
    state,
    widgetManager: { userId },
    _toast: vi.fn(),
    claimCharacter: vi.fn(),
    unclaimCharacter: vi.fn(),
    showEditCharacterForm: vi.fn(),
    showEntityForm: vi.fn(),
    saveCharacterAsTemplate: vi.fn(),
    placeSheetOnMap: vi.fn(),
    clearSelectedNPC: vi.fn(),
    rollAttributeCheck: vi.fn(),
  };
}

function makeChar(overrides = {}) {
  return {
    id: 'chr-1', type: 'pc', name: 'Aria', class_level: 'Wizard 5', species: 'Gnome',
    hp_current: 20, hp_max: 30, ac: 14, speed: 30, initiative_bonus: 2,
    conditions: [], attributes: { str: 10, dex: 14, con: 12, int: 16, wis: 12, cha: 10 },
    claimed_by_user_id: null, inventory_ids: [],
    ...overrides,
  };
}

beforeEach(() => { document.body.innerHTML = ''; });

// ── CharacterSheet - core render ─────────────────────────────────────────────

describe('<CharacterSheet> - rendering', () => {
  it('shows the character name and subtitle', () => {
    const { container } = render(h(CharacterSheet, { ui: mkUi({ currentCharacter: makeChar() }) }));
    expect(container.textContent).toContain('Aria');
    expect(container.textContent).toContain('Wizard 5');
    expect(container.textContent).toContain('Gnome');
  });

  it('renders the first two letters of the name in the avatar', () => {
    const { container } = render(h(CharacterSheet, { ui: mkUi({ currentCharacter: makeChar({ name: 'Arielle' }) }) }));
    expect(container.querySelector('.entity-avatar').textContent).toBe('Ar');
  });

  it('renders without crash when class_level / species / attributes / conditions are missing', () => {
    const broken = makeChar({ class_level: undefined, species: undefined, attributes: undefined, conditions: undefined });
    expect(() => render(h(CharacterSheet, { ui: mkUi({ currentCharacter: broken }) }))).not.toThrow();
  });

  it('200-character name still renders without throwing; avatar shows first two letters', () => {
    const longName = 'A'.repeat(200);
    const { container } = render(h(CharacterSheet, { ui: mkUi({ currentCharacter: makeChar({ name: longName }) }) }));
    expect(container.querySelector('.entity-avatar').textContent).toBe('AA');
  });
});

// ── CharacterSheet - claim / release flow ────────────────────────────────────

describe('<CharacterSheet> - claim / release', () => {
  it('character claimed by current user shows "Your Character" and Release control', () => {
    const ui = mkUi({ currentCharacter: makeChar({ claimed_by_user_id: '@me:s' }) });
    const { container } = render(h(CharacterSheet, { ui }));
    expect(container.textContent.toLowerCase()).toContain('your character');
    const release = container.querySelector('[aria-label="Release character"]');
    expect(release).toBeTruthy();
  });

  it('character claimed by another user shows "Claimed By", no claim/release button', () => {
    const ui = mkUi({ currentCharacter: makeChar({ claimed_by_user_id: '@other:s' }) });
    const { container } = render(h(CharacterSheet, { ui }));
    expect(container.textContent.toLowerCase()).toContain('claimed by');
    expect(container.querySelector('[aria-label="Release character"]')).toBeNull();
    expect(container.querySelector('[aria-label="Claim this character"]')).toBeNull();
  });

  it('unclaimed character shows Claim button', () => {
    const ui = mkUi({ currentCharacter: makeChar({ claimed_by_user_id: null }) });
    const { container } = render(h(CharacterSheet, { ui }));
    const claim = container.querySelector('[aria-label="Claim this character"]');
    expect(claim).toBeTruthy();
  });

  it('clicking Release invokes ui.unclaimCharacter', () => {
    const ui = mkUi({ currentCharacter: makeChar({ claimed_by_user_id: '@me:s' }) });
    const { container } = render(h(CharacterSheet, { ui }));
    container.querySelector('[aria-label="Release character"]').click();
    expect(ui.unclaimCharacter).toHaveBeenCalledWith('chr-1');
  });

  it('clicking Claim invokes ui.claimCharacter', () => {
    const ui = mkUi({ currentCharacter: makeChar({ claimed_by_user_id: null }) });
    const { container } = render(h(CharacterSheet, { ui }));
    container.querySelector('[aria-label="Claim this character"]').click();
    expect(ui.claimCharacter).toHaveBeenCalledWith('chr-1');
  });
});

// ── NPCSheet - core render ───────────────────────────────────────────────────

function makeNPC(overrides = {}) {
  return {
    id: 'npc-1', type: 'npc', name: 'Goblin Scout', cr: '1/4', size_category: 'Small',
    hp_current: 7, hp_max: 10, ac: 13, speed: 30,
    attributes: {}, actions: [], ...overrides,
  };
}

describe('<NPCSheet> - rendering', () => {
  it('shows NPC name and meta (CR, size, creature_type)', () => {
    const { container } = render(h(NPCSheet, { ui: mkUi({ currentNPC: makeNPC({ creature_type: 'Humanoid' }) }) }));
    expect(container.querySelector('.entity-name').textContent).toContain('Goblin Scout');
    expect(container.querySelector('.entity-subtitle').textContent).toMatch(/CR 1\/4.*Small.*Humanoid/);
  });

  it('shows Edit button for GM; hides it for non-GM', () => {
    const gm = mkUi({ currentNPC: makeNPC(), isGM: true });
    const { container: gmC } = render(h(NPCSheet, { ui: gm }));
    expect(gmC.querySelector('[aria-label="Edit NPC"]')).toBeTruthy();

    const player = mkUi({ currentNPC: makeNPC(), isGM: false });
    const { container: pC } = render(h(NPCSheet, { ui: player }));
    expect(pC.querySelector('[aria-label="Edit NPC"]')).toBeNull();
  });

  it('clicking Edit invokes showEntityForm with ENTITY_TYPES.NPC and id', () => {
    const ui = mkUi({ currentNPC: makeNPC(), isGM: true });
    const { container } = render(h(NPCSheet, { ui }));
    container.querySelector('[aria-label="Edit NPC"]').click();
    expect(ui.showEntityForm).toHaveBeenCalledWith('npc', 'npc-1');
  });

  it('Back button clears the selected NPC', () => {
    const ui = mkUi({ currentNPC: makeNPC() });
    const { container } = render(h(NPCSheet, { ui }));
    const back = container.querySelector('[aria-label="Back to list"]');
    expect(back).toBeTruthy();
    back.click();
    expect(ui.clearSelectedNPC).toHaveBeenCalled();
  });
});
