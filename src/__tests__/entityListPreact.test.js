/**
 * EntityList Preact component - replaces the legacy `renderEntityList`
 * TrustedMarkup feeds in CharacterSheet.jsx and NPCSheet.jsx.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, h } from 'preact';
import { EntityList } from '../ui/EntityList.jsx';
import { ENTITY_TYPES } from '../utils/constants.js';

function mkUi({
  isGM = false, userId = '@me:s',
  characters = [], npcs = [],
  canEdit = false,
  handlers = {},
} = {}) {
  return {
    state: {
      isGM: () => isGM,
      characters: new Map(characters),
      npcs: new Map(npcs),
      canEditEntity: () => canEdit,
    },
    widgetManager: { userId },
    selectCharacterById: handlers.selectCharacter ?? vi.fn(),
    selectNPCById: handlers.selectNPC ?? vi.fn(),
    showEntityForm: handlers.showEntityForm ?? vi.fn(),
    showEditCharacterForm: handlers.showEditCharacter ?? vi.fn(),
    showCharacterWizard: handlers.showWizard ?? vi.fn(),
    showAddNPCForm: handlers.showAddNPC ?? vi.fn(),
    deleteCharacter: handlers.deleteCharacter ?? vi.fn(),
    deleteNPC: handlers.deleteNPC ?? vi.fn(),
  };
}

function mount(ui, type) {
  const host = document.createElement('div');
  render(h(EntityList, { ui, type }), host);
  return host;
}

describe('<EntityList type=PC> - empty state', () => {
  it('shows Create + Wizard buttons when there are no characters', () => {
    const host = mount(mkUi({ characters: [] }), ENTITY_TYPES.PC);
    expect(host.textContent).toContain('No characters yet');
    expect(host.querySelector('[data-create-character]')).toBeTruthy();
    expect(host.querySelector('[data-character-wizard]')).toBeTruthy();
  });

  it('Create button opens the PC form', () => {
    const showEntityForm = vi.fn();
    const host = mount(mkUi({ handlers: { showEntityForm } }), ENTITY_TYPES.PC);
    host.querySelector('[data-create-character]').click();
    expect(showEntityForm).toHaveBeenCalledWith(ENTITY_TYPES.PC);
  });
});

describe('<EntityList type=NPC> - empty state', () => {
  it('shows Add-NPC only for GMs', () => {
    const gmHost = mount(mkUi({ isGM: true }), ENTITY_TYPES.NPC);
    expect(gmHost.querySelector('[data-add-npc]')).toBeTruthy();
    const playerHost = mount(mkUi({ isGM: false }), ENTITY_TYPES.NPC);
    expect(playerHost.querySelector('[data-add-npc]')).toBeNull();
    expect(playerHost.textContent).toContain('No NPCs yet');
  });
});

describe('<EntityList type=PC> - cards', () => {
  const characters = [
    ['c-a', { name: 'Aria', class_level: 'Fighter 3', species: 'Human', hp_current: 20, hp_max: 30, player_user_id: '@me:s' }],
    ['c-b', { name: 'Bran', class_level: 'Wizard 2', species: 'Elf',   hp_current: 14, hp_max: 14 }],
  ];

  it('renders one card per character, sorted by name', () => {
    const host = mount(mkUi({ characters }), ENTITY_TYPES.PC);
    const cards = host.querySelectorAll('[data-character-card]');
    expect(cards).toHaveLength(2);
    expect(cards[0].getAttribute('data-character-card')).toBe('c-a');
  });

  it('clicking a card calls selectCharacterById', () => {
    const selectCharacter = vi.fn();
    const host = mount(mkUi({ characters, handlers: { selectCharacter } }), ENTITY_TYPES.PC);
    host.querySelector('[data-character-card="c-b"] .card__hit').click();
    expect(selectCharacter).toHaveBeenCalledWith('c-b');
  });

  it('edit/delete buttons fire and stop propagation', () => {
    const selectCharacter = vi.fn();
    const showEditCharacter = vi.fn();
    const deleteCharacter = vi.fn();
    const host = mount(mkUi({
      characters, canEdit: true,
      handlers: { selectCharacter, showEditCharacter, deleteCharacter },
    }), ENTITY_TYPES.PC);
    const card = host.querySelector('[data-character-card="c-a"]');
    card.querySelector('button[aria-label="Edit"]').click();
    expect(showEditCharacter).toHaveBeenCalledWith('c-a');
    expect(selectCharacter).not.toHaveBeenCalled();
    card.querySelector('button[aria-label="Delete"]').click();
    expect(deleteCharacter).toHaveBeenCalledWith('c-a');
  });
});

describe('<EntityList> - escape contract (structural)', () => {
  it('XSS-shaped character names render as text, never as <script>', () => {
    const host = mount(mkUi({
      characters: [
        ['c-a', { name: '<script>alert(1)</script>', player_user_id: '@me:s', hp_current: 1, hp_max: 1 }],
      ],
    }), ENTITY_TYPES.PC);
    expect(host.querySelector('script')).toBeNull();
    expect(host.textContent).toContain('<script>alert(1)</script>');
    // The name also feeds the hit button's accessible name; it must
    // arrive via the attribute path (setAttribute), never HTML parsing.
    const hit = host.querySelector('.card__hit');
    expect(hit.getAttribute('aria-label')).toBe('Select <script>alert(1)</script>');
    expect(hit.children).toHaveLength(0);
  });

  it('XSS-shaped ids do not break attribute context', () => {
    const host = mount(mkUi({
      characters: [
        ['c-"><img src=x>', { name: 'Ok', player_user_id: '@me:s', hp_current: 1, hp_max: 1 }],
      ],
    }), ENTITY_TYPES.PC);
    expect(host.querySelector('img')).toBeNull();
  });
});

describe('<EntityList> - card HP row for non-d20 systems', () => {
  it('hides the HP bar and label when the entity has no hp fields', () => {
    const host = mount(mkUi({
      characters: [['c1', { id: 'c1', name: 'Toast', type: ENTITY_TYPES.PC, attributes: { cliche1: 4 } }]],
    }), ENTITY_TYPES.PC);
    expect(host.textContent).not.toContain('undefined');
    expect(host.textContent).not.toContain('HP:');
    expect(host.querySelector('.hp-bar')).toBeFalsy();
  });

  it('keeps the HP bar when hp fields exist', () => {
    const host = mount(mkUi({
      characters: [['c1', { id: 'c1', name: 'Aria', type: ENTITY_TYPES.PC, hp_current: 7, hp_max: 10 }]],
    }), ENTITY_TYPES.PC);
    expect(host.textContent).toContain('HP:');
    expect(host.querySelector('.hp-bar')).toBeTruthy();
  });
});
