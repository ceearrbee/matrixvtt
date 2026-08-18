import { describe, it, expect } from 'vitest';
import spellsFile from '../content/compendium/dnd5e/spells.json' with { type: 'json' };
import monstersFile from '../content/compendium/dnd5e/monsters.json' with { type: 'json' };
import itemsFile from '../content/compendium/dnd5e/items.json' with { type: 'json' };
import { validateSpell, validateItem } from '../utils/schemas/content.js';
import { validateCharacter } from '../utils/schemas/actors.js';
import { hasCompendium, loadCompendium } from '../content/compendium/index.js';
import dnd5e from '../content/rulesets/dnd5e.json' with { type: 'json' };

const FILES = [spellsFile, monstersFile, itemsFile];

describe('dnd5e compendium data', () => {
  it('carries CC-BY-4.0 attribution metadata in every file', () => {
    for (const file of FILES) {
      expect(file.meta.license).toBe('CC-BY-4.0');
      expect(file.meta.attribution).toContain('System Reference Document 5.1');
      expect(file.meta.attribution).toContain('Wizards of the Coast');
      expect(file.meta.source_dataset.repo).toBe('5e-bits/5e-database');
    }
  });

  it('ships the full SRD 5.1 counts', () => {
    expect(spellsFile.entries.length).toBe(319);
    expect(monstersFile.entries.length).toBe(334);
    expect(itemsFile.entries.length).toBeGreaterThan(500);
  });

  it('tags every entry with its source', () => {
    for (const file of FILES) {
      for (const entry of file.entries) {
        expect(entry.source).toBe('SRD 5.1');
      }
    }
  });

  it('uses unique ids across all files', () => {
    const ids = FILES.flatMap((f) => f.entries.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every spell passes spell validation', () => {
    for (const spell of spellsFile.entries) {
      expect(validateSpell(spell), spell.id).toBe(true);
    }
  });

  it('every monster passes NPC character validation against the 5e ruleset', () => {
    for (const npc of monstersFile.entries) {
      expect(validateCharacter(npc, dnd5e), npc.id).toBe(true);
    }
  });

  it('every item passes item validation', () => {
    for (const item of itemsFile.entries) {
      expect(validateItem(item), item.id).toBe(true);
    }
  });
});

describe('compendium loader', () => {
  it('reports which systems have a compendium', () => {
    expect(hasCompendium('dnd5e')).toBe(true);
    expect(hasCompendium('fate')).toBe(false);
    expect(hasCompendium(undefined)).toBe(false);
  });

  it('lazily loads the dnd5e compendium', async () => {
    const compendium = await loadCompendium('dnd5e');
    expect(compendium.spells.entries.length).toBe(319);
    expect(compendium.monsters.entries.length).toBe(334);
    expect(compendium.items.entries.length).toBeGreaterThan(500);
    expect(compendium.meta.license).toBe('CC-BY-4.0');
  });

  it('returns null for systems without a compendium', async () => {
    expect(await loadCompendium('fate')).toBe(null);
  });
});
