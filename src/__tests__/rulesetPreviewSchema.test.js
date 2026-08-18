/**
 * The dnd5e ruleset must ship character_preview / npc_preview /
 * item_preview blocks so the demo session exercises the preview
 * popup feature end-to-end. Other rulesets are allowed to omit those
 * blocks - the preview helpers fall back to the corresponding
 * sheet/card sections - so this guard is dnd5e-specific.
 *
 * Production: src/ui/preview/preview-modals.js (`_previewSections`).
 */
import { describe, it, expect } from 'vitest';
import dnd5e from '../content/rulesets/dnd5e.json' with { type: 'json' };
import fate from '../content/rulesets/fate.json' with { type: 'json' };
import gurps from '../content/rulesets/gurps.json' with { type: 'json' };
import opend6 from '../content/rulesets/opend6.json' with { type: 'json' };
import ose from '../content/rulesets/ose.json' with { type: 'json' };
import pbta from '../content/rulesets/pbta.json' with { type: 'json' };
import savageWorlds from '../content/rulesets/savage-worlds.json' with { type: 'json' };
import wod from '../content/rulesets/wod.json' with { type: 'json' };

const ALL_RULESETS = {
  'dnd5e': dnd5e, 'fate': fate, 'gurps': gurps, 'opend6': opend6,
  'ose': ose, 'pbta': pbta, 'savage_worlds': savageWorlds, 'wod': wod,
};

describe('dnd5e ruleset - preview blocks', () => {
  it('character_preview.sections is a non-empty array', () => {
    expect(Array.isArray(dnd5e.character_preview?.sections)).toBe(true);
    expect(dnd5e.character_preview.sections.length).toBeGreaterThan(0);
  });

  it('npc_preview.sections is a non-empty array', () => {
    expect(Array.isArray(dnd5e.npc_preview?.sections)).toBe(true);
    expect(dnd5e.npc_preview.sections.length).toBeGreaterThan(0);
  });

  it('item_preview.sections is a non-empty array and includes the rollable kinds', () => {
    expect(Array.isArray(dnd5e.item_preview?.sections)).toBe(true);
    const kinds = dnd5e.item_preview.sections.map((s) => s.kind);
    for (const k of ['attack_roll', 'damage_roll', 'use_consumable']) {
      expect(kinds, `item_preview must include ${k}`).toContain(k);
    }
  });

  it('spell_preview.sections includes cast / damage / save kinds', () => {
    expect(Array.isArray(dnd5e.spell_preview?.sections)).toBe(true);
    const kinds = dnd5e.spell_preview.sections.map((s) => s.kind);
    for (const k of ['cast_spell', 'spell_damage_roll', 'spell_save_roll']) {
      expect(kinds, `spell_preview must include ${k}`).toContain(k);
    }
  });
});

describe('every shipped ruleset declares the preview blocks', () => {
  // Each system makes its preview shape explicit instead of relying on
  // the silent fallback to character_sheet / npc_sheet. Authors of new
  // systems learn the contract by reading the existing ones.
  for (const [name, ruleset] of Object.entries(ALL_RULESETS)) {
    it(`${name} ships character_preview + npc_preview`, () => {
      expect(Array.isArray(ruleset.character_preview?.sections), `${name} character_preview`).toBe(true);
      expect(ruleset.character_preview.sections.length).toBeGreaterThan(0);
      expect(Array.isArray(ruleset.npc_preview?.sections), `${name} npc_preview`).toBe(true);
      expect(ruleset.npc_preview.sections.length).toBeGreaterThan(0);
    });
  }
});

describe('every shipped ruleset declares item_preview with rollable kinds', () => {
  // Demonstrates the JSON-first promise: any system can opt into the
  // preview popup with rollable affordances. Rulesets that haven't
  // authored a character/npc preview fall back through the chain
  // (npc_preview ?? npc_sheet ?? character_sheet) - see preview-modals.js.
  const REQUIRED = ['attack_roll', 'damage_roll', 'use_consumable'];
  for (const [name, ruleset] of Object.entries(ALL_RULESETS)) {
    it(`${name} ships item_preview`, () => {
      expect(Array.isArray(ruleset.item_preview?.sections), `${name} item_preview`).toBe(true);
      const kinds = ruleset.item_preview.sections.map((s) => s.kind);
      for (const k of REQUIRED) {
        expect(kinds, `${name} item_preview must include ${k}`).toContain(k);
      }
    });
  }
});
