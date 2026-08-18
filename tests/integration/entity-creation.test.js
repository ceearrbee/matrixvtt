/**
 * Entity creation contract tests
 *
 * These verify that the entity shapes produced by the application still pass
 * the real validators used before Matrix state events are sent. This is
 * contract coverage for UI-produced objects, not a full integration test.
 */

import { describe, it, expect } from 'vitest';
import {
  validateToken,
  validateCharacter,
  validateInitiative,
  validateSettings,
  validateMap,
  validateFog,
  validateStateEvent
} from '../../src/utils/schemas.js';

// ─────────────────────────────────────────────
// Token shapes
// ─────────────────────────────────────────────

describe('Token entity shape', () => {
  it('freshly created PC token passes validation', () => {
    const id = 'tok-abc123';
    const token = {
      id,                              // required
      map_id: 'm1',                   // required
      name: 'Aria',
      type: 'pc',
      col: 5, row: 3,                  // required, non-negative
      sheet_id: 'chr-abc123',          // required
      owner_user_id: '@player:server',
      hp_current: 20, hp_max: 30,
      ac: 15,
      size: 1,
      conditions: [],
      image_url: null
    };
    expect(() => validateToken(token)).not.toThrow();
  });

  it('NPC token with null owner passes validation', () => {
    const token = {
      id: 'tok-orc-1',
      map_id: 'm1',
      name: 'Orc Warrior',
      type: 'npc',
      col: 10, row: 8,
      sheet_id: 'npc-orc-template',
      owner_user_id: null,             // NPCs have no player owner
      size: 2,
      conditions: [],
      image_url: null
    };
    expect(() => validateToken(token)).not.toThrow();
  });

  it('updated token with spread-and-override preserves required fields', () => {
    const existing = {
      id: 'tok-existing',
      map_id: 'm1',
      name: 'Old Name',
      type: 'pc',
      col: 0, row: 0,
      sheet_id: 'chr-1',
      owner_user_id: '@player:server',
      conditions: []
    };
    const updated = { ...existing, name: 'New Name', col: 5, row: 5 };
    expect(() => validateToken(updated)).not.toThrow();
    expect(updated.id).toBe('tok-existing');      // id survived the spread
    expect(updated.sheet_id).toBe('chr-1');       // sheet_id survived
  });

  it('token at grid position 0,0 is valid (not "falsy zero" bug)', () => {
    const token = { id: 'tok-corner', map_id: 'm1', sheet_id: 'chr-x', col: 0, row: 0 };
    expect(() => validateToken(token)).not.toThrow();
  });

  it('token missing id is rejected', () => {
    const token = { name: 'No ID', sheet_id: 'chr-1', col: 0, row: 0 };
    expect(() => validateToken(token)).toThrow(/Token must have id/);
  });

  it('token missing sheet_id is rejected', () => {
    const token = { id: 'tok-1', map_id: 'm1', col: 0, row: 0 };
    expect(() => validateToken(token)).toThrow(/Token must have sheet_id/);
  });

  it('token with negative col is rejected', () => {
    const token = { id: 'tok-1', map_id: 'm1', sheet_id: 'chr-1', col: -1, row: 0 };
    expect(() => validateToken(token)).toThrow(/col must be non-negative/);
  });
});

// ─────────────────────────────────────────────
// Character shapes
// ─────────────────────────────────────────────

describe('Character entity shape', () => {
  it('freshly created PC character passes validation', () => {
    const char = {
      id: 'chr-abc',                   // required
      name: 'Aria Moonwhisper',        // required
      type: 'pc',                      // required: 'pc' | 'npc'
      player_user_id: '@player:server',
      species: 'Elf',
      class_level: 'Wizard 5',
      hp_max: 35, hp_current: 35,
      ac: 13, speed: 30,
      stats: { hp: 35, max_hp: 35, ac: 13, initiative: 3 },
      inventory_ids: [],
      conditions: []
    };
    expect(() => validateCharacter(char)).not.toThrow();
  });

  it('NPC character passes validation', () => {
    const npc = {
      id: 'npc-goblin-1',
      name: 'Goblin Scout',
      type: 'npc',
      stats: { hp: 7, max_hp: 7, ac: 15, initiative: 2 }
    };
    expect(() => validateCharacter(npc)).not.toThrow();
  });

  it('character update preserves id across spread', () => {
    const existing = { id: 'chr-x', name: 'Old', type: 'pc' };
    const updated = { ...existing, name: 'Updated', hp_current: 25 };
    expect(() => validateCharacter(updated)).not.toThrow();
    expect(updated.id).toBe('chr-x');
  });

  it('character missing id is rejected', () => {
    const char = { name: 'No ID', type: 'pc' };
    expect(() => validateCharacter(char)).toThrow(/Character must have id/);
  });

  it('character missing name is rejected', () => {
    const char = { id: 'chr-1', type: 'pc' };
    expect(() => validateCharacter(char)).toThrow(/Character must have name/);
  });

  it('character with invalid type is rejected', () => {
    const char = { id: 'chr-1', name: 'Hero', type: 'monster' };
    expect(() => validateCharacter(char)).toThrow(/Character type must be pc or npc/);
  });
});

// ─────────────────────────────────────────────
// Initiative shapes
// ─────────────────────────────────────────────

describe('Initiative entity shape', () => {
  const validEntry = (n) => ({
    id: `init-${n}`,
    character_id: `chr-${n}`,
    token_id: `tok-${n}`,
    name: `Hero ${n}`,
    initiative: 20 - n
  });

  it('full initiative order passes validation', () => {
    const state = {
      order: [validEntry(1), validEntry(2), validEntry(3)],
      current_index: 0,
      round: 1
    };
    expect(() => validateInitiative(state)).not.toThrow();
  });

  it('empty order with no active combat passes validation', () => {
    expect(() => validateInitiative({ order: [], current_index: 0, round: 0 })).not.toThrow();
  });

  it('initiative using "entries" field instead of "order" is rejected', () => {
    expect(() => validateInitiative({ entries: [validEntry(1)] })).toThrow(/order must be array/);
  });

  it('entry missing name is rejected', () => {
    const bad = { ...validEntry(1) };
    delete bad.name;
    expect(() => validateInitiative({ order: [bad] })).toThrow(/must have name/);
  });

  it('entry missing token_id is rejected', () => {
    const bad = { ...validEntry(1) };
    delete bad.token_id;
    expect(() => validateInitiative({ order: [bad] })).toThrow(/must have token_id/);
  });

  it('string initiative value is rejected', () => {
    const bad = { ...validEntry(1), initiative: 'high' };
    expect(() => validateInitiative({ order: [bad] })).toThrow(/numeric initiative/);
  });
});

// ─────────────────────────────────────────────
// Settings shapes
// ─────────────────────────────────────────────

describe('Settings entity shape', () => {
  it('settings with valid Matrix user IDs passes validation', () => {
    const settings = { gm_user_ids: ['@alice:matrix.org', '@bob:example.com'] };
    expect(() => validateSettings(settings)).not.toThrow();
  });

  it('settings with empty gm_user_ids passes validation (no GM assigned yet)', () => {
    // An empty array is valid - means no GM designated yet
    const settings = { gm_user_ids: [] };
    expect(() => validateSettings(settings)).not.toThrow();
  });

  it('settings missing gm_user_ids is rejected', () => {
    expect(() => validateSettings({})).toThrow(/gm_user_ids array/);
  });

  it('settings with malformed user ID is rejected', () => {
    expect(() => validateSettings({ gm_user_ids: ['not-a-matrix-id'] })).toThrow(/Invalid user ID/);
  });

  it('settings with bare username (no server) is rejected', () => {
    expect(() => validateSettings({ gm_user_ids: ['@alice'] })).toThrow(/Invalid user ID/);
  });
});

describe('Token entity shape - optional fields', () => {
  it('token with ALL optional fields populated passes validation', () => {
    const token = {
      id: 'tok-full',
      map_id: 'm1',
      sheet_id: 'chr-full',
      col: 3,
      row: 7,
      size: 2,
      conditions: ['prone', 'poisoned'],
      facing: 90,
      visible: true,
      show_hp: false,
      hp_current: 18,
      hp_max: 30,
      initiative_modifier: 3,
      color: '#ff0000',
      name: 'Fully Equipped Hero',
      image_url: 'https://example.com/hero.png'
    };
    expect(() => validateToken(token)).not.toThrow();
  });
});

describe('Character entity shape - nested stats', () => {
  it('character with deeply nested / large stats object passes validation', () => {
    const stats = {};
    // Populate many stat keys - only hp, max_hp, ac, initiative are validated as numbers
    for (let i = 0; i < 50; i++) stats[`custom_stat_${i}`] = i * 2;
    Object.assign(stats, { hp: 40, max_hp: 40, ac: 18, initiative: 5 });

    const char = { id: 'chr-big', name: 'Barbarian Max', type: 'pc', stats };
    expect(() => validateCharacter(char)).not.toThrow();
  });
});

describe('Initiative entity shape - boundary values', () => {
  it('initiative entry with initiative value of 0 passes validation', () => {
    const state = {
      order: [{
        id: 'init-zero',
        character_id: 'chr-zero',
        token_id: 'tok-zero',
        name: 'Slow Fighter',
        initiative: 0         // zero is a valid number (very unlucky roll)
      }],
      current_index: 0,
      round: 1
    };
    expect(() => validateInitiative(state)).not.toThrow();
  });
});

describe('Complete campaign contract', () => {
  const settings = {
    gm_user_ids: ['@dungeon-master:matrix.org']
  };

  const map = {
    width_cells: 30,
    height_cells: 20,
    cell_px: 50,
    image_url: 'https://example.com/dungeon.png'
  };

  const fog = {
    mode: 'hidden',
    revealed: ['0,0', '1,0', '2,0', '0,1', '1,1']
  };

  const characters = [
    { id: 'chr-pc-1', name: 'Aria', type: 'pc', stats: { hp: 35, max_hp: 35, ac: 13, initiative: 3 } },
    { id: 'chr-pc-2', name: 'Brom', type: 'pc', stats: { hp: 45, max_hp: 45, ac: 16, initiative: 1 } },
    { id: 'chr-npc-1', name: 'Goblin Chief', type: 'npc', stats: { hp: 22, max_hp: 22, ac: 14, initiative: 2 } }
  ];

  const tokens = [
    { id: 'tok-1', map_id: 'm1', sheet_id: 'chr-pc-1', col: 5, row: 4, size: 1, visible: true },
    { id: 'tok-2', map_id: 'm1', sheet_id: 'chr-pc-2', col: 7, row: 4, size: 1, visible: true },
    { id: 'tok-npc-1', map_id: 'm1', sheet_id: 'chr-npc-1', col: 12, row: 8, size: 2, visible: false }
  ];

  const initiative = {
    order: [
      { id: 'init-1', character_id: 'chr-pc-1', token_id: 'tok-1', name: 'Aria', initiative: 18 },
      { id: 'init-2', character_id: 'chr-npc-1', token_id: 'tok-npc-1', name: 'Goblin Chief', initiative: 14 },
      { id: 'init-3', character_id: 'chr-pc-2', token_id: 'tok-2', name: 'Brom', initiative: 11 }
    ],
    current_index: 0,
    round: 2
  };

  const drawing = {
    strokes: [
      { id: 's1', map_id: 'm1', type: 'pencil', points: [[0, 0], [100, 100]], color: '#ff0000', width: 3 }
    ]
  };

  it('full campaign state produced by the app passes all validators', () => {
    expect(validateSettings(settings)).toBe(true);
    expect(validateMap(map)).toBe(true);
    expect(validateFog(fog)).toBe(true);
    expect(characters.every(c => validateCharacter(c) === true)).toBe(true);
    expect(tokens.every(t => validateToken(t) === true)).toBe(true);
    expect(validateInitiative(initiative)).toBe(true);
    expect(validateStateEvent('com.vtt.drawing', drawing)).toBe(true);
  });
});
