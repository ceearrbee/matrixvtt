/**
 * UI Security / XSS Rendering Tests - Preact edition.
 *
 * Verifies that user-supplied data interpolated into the rendered DOM is
 * always structurally escaped so a malicious entity / item / spell name
 * cannot inject script tags or event-handler attributes.
 *
 * Strategy: render the live Preact components with a minimal ui+state
 * stub, then assert the resulting DOM contains neither the raw payload
 * nor the dangerous tokens (`<script`, `onerror=`, `onload=`).
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/preact';
import { h } from 'preact';

import { CharacterSheet } from '../ui/CharacterSheet.jsx';
import { NPCSheet } from '../ui/NPCSheet.jsx';
import { EntityList } from '../ui/EntityList.jsx';
import { Items } from '../ui/Items.jsx';
import { Spells } from '../ui/Spells.jsx';
import { ENTITY_TYPES } from '../utils/constants.js';

function mkUi(overrides = {}) {
  const state = {
    isGM: () => false,
    canEditEntity: () => overrides.canEdit ?? false,
    getCurrentCharacter: () => overrides.currentCharacter ?? null,
    getCurrentCharacterId: () => overrides.currentCharacterId ?? null,
    getCurrentNPC: () => overrides.currentNPC ?? null,
    getCurrentNPCId: () => overrides.currentNPCId ?? null,
    getCurrentSpells: () => overrides.spells ?? new Map(),
    characters: overrides.characters ?? new Map(),
    npcs: overrides.npcs ?? new Map(),
    items: overrides.items ?? new Map(),
    spells: overrides.spells ?? new Map(),
    tokens: new Map(),
    selectedNPCId: overrides.selectedNPCId ?? null,
    settings: { systemConfig: overrides.systemConfig ?? null, gm_user_ids: [] },
    hasTokenForSheet: () => false,
  };
  return {
    state,
    widgetManager: { userId: '@me:s', roomId: '!r:s' },
    _toast: vi.fn(),
    _log: vi.fn(),
    selectCharacterById: vi.fn(),
    selectNPCById: vi.fn(),
    showEntityForm: vi.fn(),
    showEditCharacterForm: vi.fn(),
    showCharacterWizard: vi.fn(),
    showAddNPCForm: vi.fn(),
    deleteCharacter: vi.fn(),
    deleteNPC: vi.fn(),
    rollAttributeCheck: vi.fn(),
    claimCharacter: vi.fn(),
    unclaimCharacter: vi.fn(),
    saveCharacterAsTemplate: vi.fn(),
    placeSheetOnMap: vi.fn(),
    toggleSpellPrepared: vi.fn(),
    toggleSpellSlotPip: vi.fn(),
    showSpellForm: vi.fn(),
    deleteSpell: vi.fn(),
    applyLongRest: vi.fn(),
    showItemForm: vi.fn(),
    showEditItemForm: vi.fn(),
    deleteItem: vi.fn(),
    toggleEquipItem: vi.fn(),
  };
}

function renderHTML(tree) {
  const { container } = render(tree);
  return container;
}

function assertNoRawXSS(container, payload) {
  // Structural: no parsed <script>, <img onerror=…>, <svg onload=…> nodes.
  expect(container.querySelectorAll('script')).toHaveLength(0);
  for (const el of container.querySelectorAll('*')) {
    for (const attr of el.attributes ?? []) {
      // on* event handlers: Preact ignores string values for these, but a
      // truly unescaped injection would render onerror= as an attribute.
      // Skip aria-label / title - those legitimately carry user-authored
      // strings as data, and their attribute context is quote-safe.
      if (/^on/.test(attr.name)) {
        expect.fail(`unexpected event-handler attribute ${attr.name}="${attr.value}"`);
      }
    }
  }
  if (payload.includes('<') || payload.includes('>')) {
    // In text context the payload must appear as text, never as markup.
    // (Quotes and angle brackets may appear inside attribute values, e.g.
    //  aria-label - that's quote-escaped already by the serializer.)
    const textContent = container.textContent ?? '';
    // Unescaped payload appears in text as-is; escaped payload appears too
    // but via character decoding - we still don't want the raw characters
    // interpreted as markup, which the querySelector checks above confirm.
    expect(textContent).toContain(payload);
  }
}

// ── CharacterSheet – XSS in character fields ─────────────────────────────────

describe('CharacterSheet – XSS safety', () => {
  const base = () => ({
    id: 'chr-1', name: 'Hero', class_level: 'Fighter 5', species: 'Human',
    hp_current: 40, hp_max: 40, ac: 16, speed: 30, initiative_bonus: 2,
    attributes: {}, skills: {}, conditions: [], player_user_id: null,
  });
  const PROBE = '<script>alert(1)</script>';
  const ATTR_PROBE = '"><img src=x onerror=alert(1)>';

  for (const [field, payload] of [['name', PROBE], ['class_level', ATTR_PROBE], ['species', PROBE]]) {
    it(`escapes ${field} XSS payload`, () => {
      const ui = mkUi({ currentCharacter: { ...base(), [field]: payload } });
      assertNoRawXSS(renderHTML(h(CharacterSheet, { ui })), payload);
    });
  }

  it('escapes javascript: URI in name (text context only, never href)', () => {
    const ui = mkUi({ currentCharacter: { ...base(), name: 'javascript:alert(1)' } });
    const container = renderHTML(h(CharacterSheet, { ui }));
    for (const a of container.querySelectorAll('a')) {
      expect(a.getAttribute('href') ?? '').not.toMatch(/^javascript:/i);
    }
  });

  it('escapes CSS expression in species field', () => {
    const payload = 'red; }body{background:red';
    const ui = mkUi({ currentCharacter: { ...base(), species: payload } });
    const container = renderHTML(h(CharacterSheet, { ui }));
    assertNoRawXSS(container, payload);
  });
});

// ── NPCSheet – XSS in NPC fields ─────────────────────────────────────────────

describe('NPCSheet – XSS safety', () => {
  const baseNPC = () => ({
    id: 'npc-1', name: 'Goblin Boss', cr: '5', size_category: 'Medium',
    hp_current: 100, hp_max: 100, ac: 15, speed: 30, attributes: {}, actions: [],
  });

  it('escapes XSS payload in NPC name', () => {
    const payload = '<script>alert(1)</script>';
    const ui = mkUi({ selectedNPCId: 'npc-1', npcs: new Map([['npc-1', { ...baseNPC(), name: payload }]]) });
    assertNoRawXSS(renderHTML(h(NPCSheet, { ui })), payload);
  });

  it('escapes attribute-breaking payload in CR', () => {
    const payload = '"><img src=x onerror=alert(1)>';
    const ui = mkUi({ selectedNPCId: 'npc-1', npcs: new Map([['npc-1', { ...baseNPC(), cr: payload }]]) });
    assertNoRawXSS(renderHTML(h(NPCSheet, { ui })), payload);
  });
});

// ── EntityList (character list) – XSS in list item fields ────────────────────

describe('EntityList(PC) – XSS safety', () => {
  it('escapes XSS payloads in character names', () => {
    for (const payload of ['<script>alert(1)</script>', '"><img src=x onerror=alert(1)>', "' onclick='alert(1)'"]) {
      const ui = mkUi({
        characters: new Map([['char-1', {
          id: 'char-1', type: 'pc', name: payload, class_level: 'Wizard 1',
          species: 'Gnome', hp_current: 6, hp_max: 6, claimed_by_user_id: null,
        }]]),
      });
      assertNoRawXSS(renderHTML(h(EntityList, { ui, type: ENTITY_TYPES.PC })), payload);
    }
  });
});

// ── Baseline: safe data passes through intact ────────────────────────────────

describe('rendering – safe data', () => {
  it('CharacterSheet preserves normal text', () => {
    const ui = mkUi({
      currentCharacter: {
        id: 'chr-1', name: 'Aragorn', class_level: 'Ranger 10', species: 'Human',
        hp_current: 80, hp_max: 80, ac: 18, speed: 30, initiative_bonus: 4,
        attributes: {}, skills: {}, conditions: [],
      },
    });
    const c = renderHTML(h(CharacterSheet, { ui }));
    expect(c.textContent).toContain('Aragorn');
    expect(c.textContent).toContain('Ranger 10');
    expect(c.textContent).toContain('Human');
  });

  it('NPCSheet shows placeholder when no NPC', () => {
    const c = renderHTML(h(NPCSheet, { ui: mkUi() }));
    expect(c.textContent).toContain('No NPCs yet');
    expect(c.querySelectorAll('script')).toHaveLength(0);
  });

  it('EntityList(PC) shows create button when no characters', () => {
    const c = renderHTML(h(EntityList, { ui: mkUi(), type: ENTITY_TYPES.PC }));
    expect(c.textContent).toContain('Create Character');
    expect(c.querySelectorAll('script')).toHaveLength(0);
  });
});

// ── Items – XSS prevention in item names ─────────────────────────────────────

describe('Items – XSS prevention', () => {
  const character = { id: 'char-1', name: 'Hero', inventory_ids: ['item-1'] };

  function mkItemUi(itemOverrides = {}) {
    const item = {
      id: 'item-1', name: 'Sword', type: 'weapon', quantity: 1,
      rarity: 'common', description: 'A sword.', equipped: false,
      ...itemOverrides,
    };
    return mkUi({
      currentCharacter: character,
      currentCharacterId: 'char-1',
      items: new Map([['item-1', item]]),
      canEdit: true,
      systemConfig: { item_card: { sections: [{ kind: 'description' }] } },
    });
  }

  it('script tag in item name: not rendered unescaped', () => {
    const ui = mkItemUi({ name: '<script>window.itemHacked=true</script>' });
    const c = renderHTML(h(Items, { ui }));
    expect(c.querySelectorAll('script')).toHaveLength(0);
    expect(c.textContent).toContain('<script>');
  });

  it('img onerror payload in item name: tag not rendered', () => {
    const ui = mkItemUi({ name: '<img src=x onerror=alert(1)>' });
    const c = renderHTML(h(Items, { ui }));
    expect(c.querySelectorAll('img[onerror]')).toHaveLength(0);
    expect(c.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('attribute-breaking quote in item name: no script injected', () => {
    const ui = mkItemUi({ name: '"><script>alert(1)</script>' });
    const c = renderHTML(h(Items, { ui }));
    expect(c.querySelectorAll('script')).toHaveLength(0);
  });

  it('item description with script tag: no script injected', () => {
    const ui = mkItemUi({ description: '<script>alert("desc")</script>' });
    const c = renderHTML(h(Items, { ui }));
    expect(c.querySelectorAll('script')).toHaveLength(0);
  });
});

// ── Spells – XSS prevention in spell fields ──────────────────────────────────

describe('Spells – XSS prevention', () => {
  const character = {
    id: 'char-1', name: 'Wizard', inventory_ids: [],
    spell_ids: ['spell-1'], spellcasting_ability: 'int', spell_slots: {},
  };

  function mkSpellUi(spellOverrides = {}) {
    const spell = {
      id: 'spell-1', name: 'Fireball', level: 3, school: 'Evocation',
      prepared: true, description: 'A ball of fire.',
      ...spellOverrides,
    };
    return mkUi({
      currentCharacter: character,
      currentCharacterId: 'char-1',
      spells: new Map([['spell-1', spell]]),
      canEdit: true,
    });
  }

  it('script tag in spell name: no script element injected', () => {
    const ui = mkSpellUi({ name: '<script>window.spellHacked=true</script>' });
    const c = renderHTML(h(Spells, { ui }));
    expect(c.querySelectorAll('script')).toHaveLength(0);
    expect(c.textContent).toContain('<script>');
  });

  it('attribute-breaking "><script> in spell name: no script injected', () => {
    const ui = mkSpellUi({ name: '"><script>alert(1)</script>' });
    const c = renderHTML(h(Spells, { ui }));
    expect(c.querySelectorAll('script')).toHaveLength(0);
  });

  it('svg onload payload in spell school: no svg-with-onload injected', () => {
    const ui = mkSpellUi({ school: '<svg onload=alert(1)>' });
    const c = renderHTML(h(Spells, { ui }));
    // Chrome icons render legitimate inline <svg>; the threat is an
    // injected <svg> element carrying an event handler. The payload
    // must survive only as escaped text, so no live element may have an
    // on* attribute, and the school string must not become an element.
    for (const el of c.querySelectorAll('*')) {
      for (const a of el.attributes ?? []) expect(a.name).not.toMatch(/^on/);
    }
    const school = Array.from(c.querySelectorAll('.spell-card__tag'))
      .find((t) => t.textContent.includes('<svg'));
    expect(school, 'school tag with the payload text').toBeTruthy();
    expect(school.querySelector('svg')).toBeNull();
    expect(school.textContent).toContain('<svg onload=alert(1)>');
  });

  it('onerror in spell description: no img-with-onerror injected', () => {
    const ui = mkSpellUi({ description: '<img src=x onerror=alert(1)>' });
    const c = renderHTML(h(Spells, { ui }));
    expect(c.querySelectorAll('img[onerror]')).toHaveLength(0);
  });
});
