/**
 * Event Validation Tests
 *
 * Tests all validation functions to ensure they correctly validate state events
 * and reject invalid data.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  validateSettings,
  validateMap,
  validateFog,
  validateToken,
  validateCharacter,
  validateInitiative,
  validateStateEvent,
  validateStroke,
  stateEventsEqual
} from '../schemas.js';
import { VTTError } from '../errorHandling.js';
import { EVENT_TYPES } from '../constants.js';

describe('validateFog', () => {
  it('should accept valid fog coordinates', () => {
    const validFog = {
      mode: 'hidden',
      revealed: ['0,0', '1,2', '99,99', '10,20']
    };

    expect(() => validateFog(validFog)).not.toThrow();
  });

  it('should reject invalid coordinate formats', () => {
    const invalidFormats = [
      { mode: 'hidden', revealed: ['a,b'] },      // letters
      { mode: 'hidden', revealed: ['1-2'] },      // wrong separator
      { mode: 'hidden', revealed: ['1'] },        // missing comma
      { mode: 'hidden', revealed: [''] },         // empty string
      { mode: 'hidden', revealed: ['1,'] },       // incomplete
      { mode: 'hidden', revealed: [',2'] },       // incomplete
    ];

    for (const invalid of invalidFormats) {
      expect(() => validateFog(invalid)).toThrow(VTTError);
    }
  });

  it('should reject non-string cell coordinates', () => {
    const invalidTypes = {
      mode: 'hidden',
      revealed: [123, null, undefined, { x: 0 }]
    };

    expect(() => validateFog(invalidTypes)).toThrow(VTTError);
  });

  it('accepts very large valid coordinates ("999999,999999")', () => {
    expect(() => validateFog({ mode: 'visible', revealed: ['999999,999999'] })).not.toThrow();
  });

  it('rejects negative coordinate string ("-1,2")', () => {
    expect(() => validateFog({ mode: 'visible', revealed: ['-1,2'] })).toThrow();
  });

  it('rejects float coordinate string ("1.5,2")', () => {
    expect(() => validateFog({ mode: 'visible', revealed: ['1.5,2'] })).toThrow();
  });

  it('should reject invalid fog modes', () => {
    const invalidMode = {
      mode: 'invalid_mode',
      revealed: []
    };

    expect(() => validateFog(invalidMode)).toThrow('Fog mode must be: visible, gm_only, or hidden');
  });

  it('tolerates a missing revealed array and coerces to empty', () => {
    // Missing / null `revealed` is common in older schema versions and
    // hand-authored imports. The validator normalises to [] so the event
    // doesn't silently drop during sync (a dropped event leaves fog stuck).
    const noRevealed = { mode: 'hidden' };
    expect(() => validateFog(noRevealed)).not.toThrow();
    const nullRevealed = { mode: 'hidden', revealed: null };
    expect(() => validateFog(nullRevealed)).not.toThrow();
  });
});

describe('validateToken', () => {
  it('should accept valid token with id field', () => {
    const validToken = {
      id: 'tok-123',
      map_id: 'm1',
      name: 'Hero',
      type: 'pc',
      col: 5,
      row: 3,
      hp_current: 20,
      hp_max: 30,
      ac: 15,
      size: 1,
      conditions: [],
      sheet_id: 'chr-1',
      owner_user_id: '@player:server',
      image_url: null
    };

    expect(() => validateToken(validToken)).not.toThrow();
  });

  it('should reject token without id field', () => {
    const noId = {
      name: 'Hero',
      type: 'pc',
      col: 5,
      row: 3,
      sheet_id: 'chr-1'
    };

    expect(() => validateToken(noId)).toThrow('Token must have id string');
  });

  it('should reject token without sheet_id field', () => {
    const noSheetId = {
      id: 'tok-123',
      map_id: 'm1',
      name: 'Hero',
      col: 5,
      row: 3
    };

    expect(() => validateToken(noSheetId)).toThrow('Token must have sheet_id string');
  });

  it('should validate col and row as non-negative numbers', () => {
    const negativeCol = {
      id: 'tok-123',
      map_id: 'm1',
      sheet_id: 'chr-1',
      col: -1,
      row: 3
    };

    expect(() => validateToken(negativeCol)).toThrow('Token col must be non-negative number');
  });

  it('should validate size between 1 and 4', () => {
    const invalidSize = {
      id: 'tok-123',
      map_id: 'm1',
      sheet_id: 'chr-1',
      col: 0,
      row: 0,
      size: 5
    };

    expect(() => validateToken(invalidSize)).toThrow('Token size must be 1-4');
  });

  it('rejects size out of 1-4 range and non-boolean visible', () => {
    expect(() => validateToken({ id: 't', map_id: 'm1', sheet_id: 's', col: 0, row: 0, size: 0 })).toThrow(/size must be 1-4/);
    expect(() => validateToken({ id: 't', map_id: 'm1', sheet_id: 's', col: 0, row: 0, size: 5 })).toThrow(/size must be 1-4/);
    expect(() => validateToken({ id: 't', map_id: 'm1', sheet_id: 's', col: 0, row: 0, visible: 1 })).toThrow(/visible must be boolean/);
    expect(() => validateToken({ id: 't', map_id: 'm1', sheet_id: 's', col: 0, row: 0, size: 1, visible: false })).not.toThrow();
  });

  it('rejects token that is null', () => {
    expect(() => validateToken(null)).toThrow();
  });

  it('rejects negative row', () => {
    expect(() => validateToken({ id: 't', map_id: 'm1', sheet_id: 's', col: 0, row: -1 })).toThrow(/row must be non-negative/);
  });

  it('rejects token without map_id', () => {
    expect(() => validateToken({
      id: 'tok-1', sheet_id: 'c1', col: 0, row: 0,
    })).toThrow(/Token must have map_id/);
  });
});

describe('validateCharacter', () => {
  it('should accept valid character with id field', () => {
    const validChar = {
      id: 'chr-123',
      name: 'Aria',
      type: 'pc',
      stats: {
        hp: 30,
        max_hp: 30,
        ac: 15,
        initiative: 2
      }
    };

    expect(() => validateCharacter(validChar)).not.toThrow();
  });

  it('should reject character without id field', () => {
    const noId = {
      name: 'Aria',
      type: 'pc'
    };

    expect(() => validateCharacter(noId)).toThrow('Character must have id string');
  });

  it('should require name field', () => {
    const noName = {
      id: 'chr-123',
      type: 'pc'
    };

    expect(() => validateCharacter(noName)).toThrow('Character must have name string');
  });

  it('should require type to be pc or npc', () => {
    const invalidType = {
      id: 'chr-123',
      name: 'Aria',
      type: 'invalid'
    };

    expect(() => validateCharacter(invalidType)).toThrow(/Character type must be pc or npc/);
  });

  it('should validate numeric stats', () => {
    const invalidStats = {
      id: 'chr-123',
      name: 'Aria',
      type: 'pc',
      stats: {
        hp: 'invalid'
      }
    };

    expect(() => validateCharacter(invalidStats)).toThrow('Character stats.hp must be number');
  });

  describe('Drawing Stroke Validation', () => {
    it('rejects stroke with missing ID', () => {
      const stroke = { type: 'pencil', points: [[0,0]] };
      // validateStroke is called inside validateStateEvent for DRAWING
      expect(() => validateStroke(stroke)).toThrow(/must have an id/);
    });

    it('rejects stroke with invalid type', () => {
      const stroke = { id: 's1', map_id: 'm1', type: 'invalid' };
      expect(() => validateStateEvent(EVENT_TYPES.DRAWING, stroke)).toThrow(/Invalid stroke type/);
    });

    it('rejects pencil stroke with empty points', () => {
      const stroke = { id: 's1', map_id: 'm1', type: 'pencil', points: [] };
      expect(() => validateStateEvent(EVENT_TYPES.DRAWING, stroke)).toThrow(/non-empty points array/);
    });

    it('rejects invalid color format', () => {
      const stroke = { id: 's1', map_id: 'm1', type: 'line', color: 'red' };
      expect(() => validateStateEvent(EVENT_TYPES.DRAWING, stroke)).toThrow(/Invalid color format/);
    });

    it('rejects stroke without map_id', () => {
      const stroke = { id: 's1', type: 'pencil', points: [[0, 0]] };
      expect(() => validateStroke(stroke)).toThrow(/Stroke must have map_id/);
    });
  });

  // Boundary coverage
  it('rejects empty string name', () => {
    expect(() => validateCharacter({ id: 'c', name: '', type: 'pc' })).toThrow(/name string/);
  });

  it('accepts negative stats (e.g. hp: -5 is valid for unconscious characters)', () => {
    expect(() => validateCharacter({
      id: 'c', name: 'X', type: 'pc', stats: { hp: -5, max_hp: 30 }
    })).not.toThrow();
  });

  it('rejects stats.hp as null', () => {
    expect(() => validateCharacter({
      id: 'c', name: 'X', type: 'pc', stats: { hp: null }
    })).toThrow(/hp must be number/);
  });

  it('rejects character that is null', () => {
    expect(() => validateCharacter(null)).toThrow();
  });

  it('accepts whitespace-only name (truthy string - validator does not trim; known limitation)', () => {
    // !content.name is false for '   ' (truthy), so validation passes
    // Documents current behavior: caller is responsible for trimming input
    expect(() => validateCharacter({ id: 'c', name: '   ', type: 'pc' })).not.toThrow();
  });
});

describe('validateInitiative', () => {
  const validEntry = { id: 'init-1', character_id: 'chr-1', token_id: 'tok-1', name: 'Hero', initiative: 20 };

  it('should validate initiative with order array', () => {
    const validInitiative = {
      order: [
        validEntry,
        { id: 'init-2', character_id: 'chr-2', token_id: 'tok-2', name: 'Villain', initiative: 15 }
      ],
      current_index: 0,
      round: 1
    };

    expect(() => validateInitiative(validInitiative)).not.toThrow();
  });

  it('should reject initiative with entries instead of order', () => {
    const usesEntries = {
      entries: []
    };

    expect(() => validateInitiative(usesEntries)).toThrow('Initiative order must be array');
  });

  it('should validate each entry has id', () => {
    const missingId = {
      order: [
        { character_id: 'chr-1', token_id: 'tok-1', name: 'Hero', initiative: 20 }
      ]
    };

    expect(() => validateInitiative(missingId)).toThrow('Initiative entry must have id');
  });

  it('should validate each entry has character_id', () => {
    const missingCharId = {
      order: [
        { id: 'init-1', token_id: 'tok-1', name: 'Hero', initiative: 20 }
      ]
    };

    expect(() => validateInitiative(missingCharId)).toThrow('Initiative entry must have character_id');
  });

  it('should validate initiative is numeric', () => {
    const invalidInit = {
      order: [
        { id: 'init-1', character_id: 'chr-1', token_id: 'tok-1', name: 'Hero', initiative: 'high' }
      ]
    };

    expect(() => validateInitiative(invalidInit)).toThrow('Initiative entry must have numeric initiative');
  });

  it('should validate each entry has name', () => {
    const missingName = {
      order: [
        { id: 'init-1', character_id: 'chr-1', token_id: 'tok-1', initiative: 20 }
      ]
    };

    expect(() => validateInitiative(missingName)).toThrow('Initiative entry must have name');
  });

  it('should validate each entry has token_id', () => {
    const missingTokenId = {
      order: [
        { id: 'init-1', character_id: 'chr-1', name: 'Hero', initiative: 20 }
      ]
    };

    expect(() => validateInitiative(missingTokenId)).toThrow('Initiative entry must have token_id');
  });

  it('should reject non-numeric current_index', () => {
    const badIndex = { order: [validEntry], current_index: 'first' };
    expect(() => validateInitiative(badIndex)).toThrow('Initiative current_index must be number');
  });
});

describe('validateMap', () => {
  const baseMap = { width_cells: 20, height_cells: 15, cell_px: 40 };

  it('should validate map with width_cells and height_cells', () => {
    expect(() => validateMap(baseMap)).not.toThrow();
  });

  it('should accept map without image_url (no field)', () => {
    expect(() => validateMap({ ...baseMap })).not.toThrow();
  });

  it('should accept map with image_url: null (explicit no image)', () => {
    // initBlankCampaign produces image_url: null - must not be rejected
    expect(() => validateMap({ ...baseMap, image_url: null })).not.toThrow();
  });

  it('should accept map with image_url: undefined', () => {
    expect(() => validateMap({ ...baseMap, image_url: undefined })).not.toThrow();
  });

  it('should accept map with a valid image_url string', () => {
    expect(() => validateMap({ ...baseMap, image_url: 'https://example.com/map.png' })).not.toThrow();
  });

  it('should reject map with image_url as a number', () => {
    expect(() => validateMap({ ...baseMap, image_url: 42 })).toThrow('Map image_url must be a string');
  });

  it('should reject map with width instead of width_cells', () => {
    expect(() => validateMap({ width: 20, height: 15, cell_px: 40 })).toThrow();
  });

  it('should validate cell_px field', () => {
    expect(() => validateMap({ ...baseMap, cell_px: 5 })).toThrow('Cell size must be between 10 and 100');
  });

  it('should accept empty object (tombstone)', () => {
    expect(() => validateMap({})).not.toThrow();
  });

  it('rejects out-of-range width_cells, height_cells, and cell_px', () => {
    expect(() => validateMap({ ...baseMap, width_cells: 0 })).toThrow(/width_cells/);
    expect(() => validateMap({ ...baseMap, width_cells: 101 })).toThrow(/width_cells/);
    expect(() => validateMap({ ...baseMap, height_cells: 0 })).toThrow(/height_cells/);
    expect(() => validateMap({ ...baseMap, cell_px: 9 })).toThrow(/Cell size/);
    expect(() => validateMap({ ...baseMap, cell_px: 101 })).toThrow(/Cell size/);
    expect(() => validateMap({ ...baseMap, cell_px: 10 })).not.toThrow();
  });

  it('rejects map that is null', () => {
    expect(() => validateMap(null)).toThrow();
  });

  it('rejects map with image_url as boolean', () => {
    expect(() => validateMap({ ...baseMap, image_url: true })).toThrow(/image_url must be a string/);
  });
});

describe('validateSettings', () => {
  it('should validate GM user IDs format', () => {
    const validSettings = {
      gm_user_ids: ['@alice:server.com', '@bob:matrix.org']
    };

    expect(() => validateSettings(validSettings)).not.toThrow();
  });

  it('should reject invalid user ID format', () => {
    const invalidFormat = {
      gm_user_ids: ['invalid_id']
    };

    expect(() => validateSettings(invalidFormat)).toThrow('Invalid user ID format');
  });

  it('should require gm_user_ids array', () => {
    const noGMs = {};

    expect(() => validateSettings(noGMs)).toThrow('Settings must include gm_user_ids array');
  });

  it('accepts subdomain homeserver (@alice:matrix.example.co.uk)', () => {
    expect(() => validateSettings({ gm_user_ids: ['@alice:matrix.example.co.uk'] })).not.toThrow();
  });
});

describe('validateStateEvent', () => {
  it('should route to correct validator based on type', () => {
    const tokenEvent = {
      id: 'tok-1',
      map_id: 'm1',
      sheet_id: 'chr-1',
      col: 0,
      row: 0
    };

    expect(() => validateStateEvent('com.vtt.token', tokenEvent)).not.toThrow();
  });

  it('should handle unknown event types gracefully', () => {
    const unknownEvent = { data: 'test' };

    // Should not throw; unknown types pass through silently
    expect(() => validateStateEvent('com.vtt.unknown', unknownEvent)).not.toThrow();
  });

  // Route coverage for types not yet exercised individually
  it('accepts valid com.vtt.drawing with strokes array', () => {
    expect(() => validateStateEvent('com.vtt.drawing', { strokes: [] })).not.toThrow();
  });

  it('rejects com.vtt.drawing with missing strokes field', () => {
    expect(() => validateStateEvent('com.vtt.drawing', { color: 'red' })).toThrow(/tombstone|strokes|points/);
  });

  it('accepts valid com.vtt.handout with title', () => {
    expect(() => validateStateEvent('com.vtt.handout', { title: 'Treasure Map', content: '' })).not.toThrow();
  });

  it('rejects com.vtt.handout with empty title', () => {
    expect(() => validateStateEvent('com.vtt.handout', { title: '' })).toThrow(/title string/);
  });

  it('accepts valid com.vtt.table with name and entries', () => {
    expect(() => validateStateEvent('com.vtt.table', { name: 'Wild Surge', entries: [] })).not.toThrow();
  });

  it('rejects com.vtt.table with missing entries array', () => {
    expect(() => validateStateEvent('com.vtt.table', { name: 'Table' })).toThrow(/entries array/);
  });

  it('tombstone (empty object) bypasses all validators for any type', () => {
    expect(() => validateStateEvent('com.vtt.token', {})).not.toThrow();
    expect(() => validateStateEvent('com.vtt.character', {})).not.toThrow();
    expect(() => validateStateEvent('com.vtt.fog', {})).not.toThrow();
  });

  it('validateHandout - whitespace-only title is accepted (truthy string; known limitation)', () => {
    // The validator checks !content.title which is falsy only for '' and null/undefined.
    // '   ' is truthy, so it passes. This documents current behavior.
    expect(() => validateStateEvent('com.vtt.handout', { title: '   ' })).not.toThrow();
  });

  it('validateTable - null entries field throws', () => {
    expect(() => validateStateEvent('com.vtt.table', { name: 'Loot', entries: null })).toThrow(/entries array/);
  });
});

describe('stateEventsEqual', () => {
  it('should detect identical states', () => {
    const state1 = { a: 1, b: 2 };
    const state2 = { a: 1, b: 2 };

    expect(stateEventsEqual(state1, state2)).toBe(true);
  });

  it('should detect different states', () => {
    const state1 = { a: 1, b: 2 };
    const state2 = { a: 1, b: 3 };

    expect(stateEventsEqual(state1, state2)).toBe(false);
  });

  it('should handle array order differences', () => {
    const state1 = { arr: [1, 2, 3] };
    const state2 = { arr: [1, 2, 3] };

    expect(stateEventsEqual(state1, state2)).toBe(true);
  });

  it('treats same keys in different insertion order as equal (robust deep equality)', () => {
    const state1 = { name: 'S', grid_px: 40 };
    const state2 = { grid_px: 40, name: 'S' };
    expect(stateEventsEqual(state1, state2)).toBe(true);
  });

  it('detects a changed value inside a nested object', () => {
    const state1 = { fog: { mode: 'hidden', revealed: ['0,0'] } };
    const state2 = { fog: { mode: 'visible', revealed: ['0,0'] } };
    expect(stateEventsEqual(state1, state2)).toBe(false);
  });

  it('handles null inputs', () => {
    expect(stateEventsEqual(null, null)).toBe(true);
    expect(stateEventsEqual(null, {})).toBe(false);
  });
});

// ─── Pass 16 additions ────────────────────────────────────────────────────────

describe('validateFog - boundaries', () => {
  it('throws when content is null', () => {
    expect(() => validateFog(null)).toThrow(VTTError);
  });

  it('accepts all three valid modes', () => {
    for (const mode of ['visible', 'gm_only', 'hidden']) {
      expect(() => validateFog({ mode, revealed: [] })).not.toThrow();
    }
  });

  it('accepts an empty revealed array', () => {
    expect(() => validateFog({ mode: 'hidden', revealed: [] })).not.toThrow();
  });

  it('rejects negative coordinate string ("-1,2")', () => {
    expect(() => validateFog({ mode: 'visible', revealed: ['-1,2'] })).toThrow();
  });

  it('rejects float coordinate string ("1.5,2")', () => {
    expect(() => validateFog({ mode: 'visible', revealed: ['1.5,2'] })).toThrow();
  });
});

// ─── New additions ─────────────────────────────────────────────────────────────

import { validateItem, validateSpell } from '../schemas.js';

// ─────────────────────────────────────────────────────────────────────────────
// validateItem - direct unit tests
// ─────────────────────────────────────────────────────────────────────────────
describe('validateItem - direct unit tests', () => {
  it('throws on null input', () => {
    expect(() => validateItem(null)).toThrow(VTTError);
  });

  it('throws on undefined input', () => {
    expect(() => validateItem(undefined)).toThrow(VTTError);
  });

  it('throws when content is an array (not a plain object)', () => {
    expect(() => validateItem([])).toThrow(VTTError);
  });

  it('throws when name is missing', () => {
    expect(() => validateItem({ quantity: 1 })).toThrow(/name/);
  });

  it('throws when name is empty string', () => {
    expect(() => validateItem({ name: '' })).toThrow(/name/);
  });

  it('throws when quantity is negative (-1)', () => {
    expect(() => validateItem({ name: 'Sword', quantity: -1 })).toThrow(/quantity/);
  });

  it('accepts quantity: 0 (valid boundary)', () => {
    expect(() => validateItem({ name: 'Sword', quantity: 0 })).not.toThrow();
  });

  it('throws when equipped is a string "true" (not boolean)', () => {
    expect(() => validateItem({ name: 'Sword', equipped: 'true' })).toThrow(/equipped/);
  });

  it('accepts a fully valid item', () => {
    expect(() => validateItem({ name: 'Longsword', quantity: 1, equipped: true })).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateSpell - direct unit tests
// ─────────────────────────────────────────────────────────────────────────────
describe('validateSpell - direct unit tests', () => {
  it('throws on null input', () => {
    expect(() => validateSpell(null)).toThrow(VTTError);
  });

  it('throws on undefined input', () => {
    expect(() => validateSpell(undefined)).toThrow(VTTError);
  });

  it('rejects level outside 0-9 and accepts boundaries', () => {
    expect(() => validateSpell({ name: 'Cantrip', level: -1 })).toThrow(/level/);
    expect(() => validateSpell({ name: 'Overpowered', level: 10 })).toThrow(/level/);
    expect(() => validateSpell({ name: 'Prestidigitation', level: 0 })).not.toThrow();
    expect(() => validateSpell({ name: 'Wish', level: 9 })).not.toThrow();
  });

  it('throws when level is 1.5 (non-integer)', () => {
    expect(() => validateSpell({ name: 'Fireball', level: 1.5 })).toThrow(/level/);
  });

  it('throws when level is a string "3"', () => {
    expect(() => validateSpell({ name: 'Fireball', level: '3' })).toThrow(/level/);
  });

  it('throws when name is missing', () => {
    expect(() => validateSpell({ level: 1 })).toThrow(/name/);
  });

  it('throws when name is empty string', () => {
    expect(() => validateSpell({ name: '', level: 1 })).toThrow(/name/);
  });

  it('throws when prepared is string "yes" (not boolean)', () => {
    expect(() => validateSpell({ name: 'Fireball', level: 3, prepared: 'yes' })).toThrow(/prepared/);
  });

  it('accepts a fully valid spell with prepared boolean', () => {
    expect(() => validateSpell({ name: 'Fireball', level: 3, prepared: true })).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateMap - boundary completeness
// ─────────────────────────────────────────────────────────────────────────────
describe('validateMap - boundary completeness', () => {
  const base = { width_cells: 20, height_cells: 15, cell_px: 40 };

  it('accepts valid boundaries and rejects out-of-range values', () => {
    expect(() => validateMap({ ...base, width_cells: 1 })).not.toThrow();
    expect(() => validateMap({ ...base, width_cells: 100 })).not.toThrow();
    expect(() => validateMap({ ...base, height_cells: 101 })).toThrow(/height_cells/);
  });
});

describe('validateFog - revealed item validation', () => {
  it('rejects object with toString returning "0,0" (not a string type)', () => {
    const fakeString = { toString: () => '0,0' };
    expect(() => validateFog({ mode: 'hidden', revealed: [fakeString] })).toThrow(VTTError);
  });

  it('rejects null item in revealed array', () => {
    expect(() => validateFog({ mode: 'hidden', revealed: [null] })).toThrow(VTTError);
  });

  it('rejects undefined item in revealed array', () => {
    expect(() => validateFog({ mode: 'hidden', revealed: [undefined] })).toThrow(VTTError);
  });
});

describe('validateToken - boundaries', () => {
  const base = { id: 'tok', map_id: 'm1', sheet_id: 's', col: 0, row: 0 };

  it('rejects size above the supported range', () => {
    expect(() => validateToken({ ...base, size: 4.5 })).toThrow(/size must be 1-4/);
  });

  it('col: 1000 is accepted (large valid value)', () => {
    expect(() => validateToken({ ...base, col: 1000 })).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateCharacter - type: null
// ─────────────────────────────────────────────────────────────────────────────
describe('validateCharacter - explicit null type', () => {
  it('throws when type is null (not "pc" or "npc")', () => {
    expect(() => validateCharacter({ id: 'c', name: 'Hero', type: null })).toThrow(/type must be pc or npc/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateInitiative - current_index edge values
// ─────────────────────────────────────────────────────────────────────────────
describe('validateInitiative - current_index edge values', () => {
  const validEntry = { id: 'i', character_id: 'c', token_id: 't', name: 'Hero', initiative: 10 };

  it('throws when current_index is string "0"', () => {
    expect(() => validateInitiative({ order: [validEntry], current_index: '0' })).toThrow(/current_index must be number/);
  });

  it('accepts empty order array (no entries to validate)', () => {
    expect(() => validateInitiative({ order: [] })).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateStateEvent - prototype pollution
// ─────────────────────────────────────────────────────────────────────────────
describe('validateStateEvent - prototype pollution safety', () => {
  it('fog event with __proto__ content is rejected by validator (invalid mode)', () => {
    const poisoned = Object.create(null);
    poisoned.mode = 'invalid';
    poisoned.revealed = [];
    poisoned.__proto__ = { isAdmin: true };
    expect(() => validateStateEvent('com.vtt.fog', poisoned)).toThrow();
  });

  it('does not mutate Object.prototype after processing a crafted content object', () => {
    // Attempt to pass a content object that looks like it could pollute the prototype.
    // The validator only reads content fields - it must not write to Object.prototype.
    const crafted = JSON.parse('{"__proto__": {"isAdmin": true}, "mode": "hidden", "revealed": []}');
    try {
      validateStateEvent('com.vtt.fog', crafted);
    } catch {
      // May or may not throw - what matters is that Object.prototype is clean.
    }
    expect(({}).isAdmin).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// stateEventsEqual - undefined/null inputs
// ─────────────────────────────────────────────────────────────────────────────
describe('stateEventsEqual - undefined/null inputs', () => {
  it('(undefined, undefined) → true (both JSON.stringify to undefined, undefined === undefined)', () => {
    // JSON.stringify(undefined) returns undefined (not a string).
    // undefined === undefined is true.
    expect(stateEventsEqual(undefined, undefined)).toBe(true);
  });

  it('(undefined, null) → false', () => {
    // JSON.stringify(undefined) → undefined; JSON.stringify(null) → "null"
    // undefined !== "null"
    expect(stateEventsEqual(undefined, null)).toBe(false);
  });

  it('({}, undefined) → false', () => {
    // JSON.stringify({}) → "{}"; JSON.stringify(undefined) → undefined
    // "{}" !== undefined
    expect(stateEventsEqual({}, undefined)).toBe(false);
  });
});

describe('validateToken - col/row type checks', () => {
  it('rejects col as string "3"', () => {
    expect(() => validateToken({ id: 't', map_id: 'm1', sheet_id: 's', col: '3', row: 0 })).toThrow();
  });

  it('rejects row as string "0"', () => {
    expect(() => validateToken({ id: 't', map_id: 'm1', sheet_id: 's', col: 0, row: '0' })).toThrow();
  });

  it('accepts col: 0 and row: 0 (minimum valid coordinates)', () => {
    expect(() => validateToken({ id: 't', map_id: 'm1', sheet_id: 's', col: 0, row: 0 })).not.toThrow();
  });
});

describe('validateInitiative - round field', () => {
  const validEntry = { id: 'i1', character_id: 'c1', token_id: 't1', name: 'H', initiative: 10 };

  it('rejects round as string', () => {
    expect(() => validateInitiative({ order: [validEntry], round: 'one' })).toThrow(/round must be number/);
  });

  it('accepts round: 0 (valid number)', () => {
    expect(() => validateInitiative({ order: [validEntry], round: 0 })).not.toThrow();
  });

  it('throws when content is null', () => {
    expect(() => validateInitiative(null)).toThrow(VTTError);
  });
});

describe('validateSettings - additional cases', () => {
  it('accepts empty gm_user_ids array', () => {
    expect(() => validateSettings({ gm_user_ids: [] })).not.toThrow();
  });

  it('throws when content is null', () => {
    expect(() => validateSettings(null)).toThrow(VTTError);
  });

  it('throws when gm_user_ids is a string instead of array', () => {
    expect(() => validateSettings({ gm_user_ids: '@gm:server' })).toThrow(/gm_user_ids array/);
  });
});

describe('stateEventsEqual - array and nested object comparisons', () => {
  it('returns true for two empty objects', () => {
    expect(stateEventsEqual({}, {})).toBe(true);
  });

  it('returns false for arrays with different lengths', () => {
    expect(stateEventsEqual({ arr: [1, 2] }, { arr: [1] })).toBe(false);
  });

  it('returns false for nested object with changed value', () => {
    expect(stateEventsEqual({ fog: { mode: 'hidden' } }, { fog: { mode: 'visible' } })).toBe(false);
  });
});

// ─── Action economy flags ─────────────────────────────────────────────────────

describe('validateInitiative - action economy flags', () => {
  const base = { id: 'i1', character_id: 'c1', token_id: 't1', name: 'H', initiative: 10 };

  it('accepts entry with action_used: true', () => {
    expect(() => validateInitiative({ order: [{ ...base, action_used: true }] })).not.toThrow();
  });

  it('accepts entry with all three flags false', () => {
    const entry = { ...base, action_used: false, bonus_action_used: false, reaction_used: false };
    expect(() => validateInitiative({ order: [entry] })).not.toThrow();
  });

  it('rejects action_used: 1 (non-boolean)', () => {
    expect(() => validateInitiative({ order: [{ ...base, action_used: 1 }] }))
      .toThrow(/action_used must be boolean/);
  });

  it('rejects bonus_action_used: "yes"', () => {
    expect(() => validateInitiative({ order: [{ ...base, bonus_action_used: 'yes' }] }))
      .toThrow(/bonus_action_used must be boolean/);
  });

  it('rejects reaction_used: null', () => {
    expect(() => validateInitiative({ order: [{ ...base, reaction_used: null }] }))
      .toThrow(/reaction_used must be boolean/);
  });
});

describe('validateFog – no console side effects', () => {
  it('does not call console.error when rejecting an invalid cell coordinate', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      validateFog({ mode: 'hidden', revealed: ['not-a-coord'] });
    } catch { /* expected */ }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('validateStateEvent – no console side effects', () => {
  it('does not call console.warn for an unknown event type', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    validateStateEvent('com.vtt.unknown_type', { anything: true });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('validateLight (Phase 5J.3)', () => {
  it('accepts a well-formed light', () => {
    expect(validateStateEvent(EVENT_TYPES.LIGHT, {
      id: 'l1', map_id: 'm1', x: 100, y: 100, radius_px: 50, intensity: 0.6, color: 'ffaa00ff',
    })).toBe(true);
  });

  it('rejects a light without id', () => {
    expect(() => validateStateEvent(EVENT_TYPES.LIGHT, {
      x: 0, y: 0, radius_px: 10,
    })).toThrow(/Light must have id/);
  });

  it('rejects negative radius', () => {
    expect(() => validateStateEvent(EVENT_TYPES.LIGHT, {
      id: 'l1', map_id: 'm1', x: 0, y: 0, radius_px: -5,
    })).toThrow(/non-negative/);
  });

  it('rejects a light without map_id', () => {
    expect(() => validateStateEvent(EVENT_TYPES.LIGHT, {
      id: 'l1', x: 0, y: 0, radius_px: 10,
    })).toThrow(/Light must have map_id/);
  });
});

describe('validatePin', () => {
  it('rejects a pin without map_id', () => {
    expect(() => validateStateEvent(EVENT_TYPES.PIN, {
      id: 'p1', col: 0, row: 0, label: 'X',
    })).toThrow(/Pin must have map_id/);
  });
});

describe('validateTemplate', () => {
  it('rejects a template without map_id', () => {
    expect(() => validateStateEvent(EVENT_TYPES.TEMPLATE, {
      id: 't1', shape: 'circle', origin: { col: 0, row: 0 },
    })).toThrow(/Template must have map_id/);
  });
});

describe('validateWall - map_id required (Phase 1)', () => {
  it('rejects a wall without map_id', () => {
    expect(() => validateStateEvent(EVENT_TYPES.WALL, {
      id: 'w1', p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 },
    })).toThrow(/Wall must have map_id/);
  });

  it('accepts a wall with a string map_id', () => {
    expect(validateStateEvent(EVENT_TYPES.WALL, {
      id: 'w1', map_id: 'map-1', p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 },
    })).toBe(true);
  });
});

describe('validateCharacter - NPC action arrays (Phase 1.25/1.26)', () => {
  const baseNPC = {
    id: 'npc-1',
    name: 'Goblin',
    type: 'npc',
  };

  it('accepts an NPC with legendary, lair, reactions and traits arrays', () => {
    expect(validateCharacter({
      ...baseNPC,
      actions: [{ name: 'Bite', description: 'bites' }],
      legendary_actions: [{ name: 'Tail Swipe', description: 'swipes' }],
      lair_actions: [{ name: 'Cave-in', description: 'cave-in' }],
      reactions: [{ name: 'Dodge', description: 'dodges' }],
      traits: [{ name: 'Pack Tactics', description: 'tactics' }],
    })).toBe(true);
  });

  it('rejects when reactions is not an array', () => {
    expect(() => validateCharacter({
      ...baseNPC,
      reactions: 'oops',
    })).toThrow(/reactions must be an array/);
  });

  it('rejects when an action entry is missing name', () => {
    expect(() => validateCharacter({
      ...baseNPC,
      legendary_actions: [{ description: 'no name' }],
    })).toThrow(/legendary_actions entries must have a name/);
  });
});
