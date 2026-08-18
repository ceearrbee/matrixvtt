/**
 * End-to-end smoke that the dnd5e character_form renders the
 * expanded D&D 5e field set (level, XP, hp_temp, alignment,
 * background, ideals, bonds, flaws) and the FormReader picks them
 * up via getPCSchema.
 */
import { describe, it, expect } from 'vitest';
import { getPCSchema } from '../ui/entity/forms.js';
import dnd5eRuleset from '../content/rulesets/dnd5e.json' with { type: 'json' };

describe('dnd5e character_form covers the 5e fields', () => {
  it('declares the progression + identity + personality fields', () => {
    const ids = collectFieldIds(dnd5eRuleset.character_form.fields);
    for (const expected of [
      'species', 'class_level',
      'level', 'xp_current', 'xp_next_level',
      'hp_max', 'hp_current', 'hp_temp', 'ac', 'speed', 'initiative_bonus',
      'alignment', 'background', 'ideals', 'bonds', 'flaws', 'notes',
    ]) {
      expect(ids).toContain(expected);
    }
  });
});

describe('getPCSchema picks up every new field', () => {
  it('every declared form-field id has a matching schema entry', () => {
    const ids = collectFieldIds(dnd5eRuleset.character_form.fields);
    const { fields } = getPCSchema();
    // attributes is handled separately (not via FormReader field map),
    // so skip it. Same for any compound "row" kinds.
    const collectable = ids.filter((id) => id !== 'attributes');
    for (const id of collectable) {
      expect(fields[id], `Field map missing entry for ${id}`).toBeTruthy();
    }
  });
});

function collectFieldIds(fields, out = []) {
  if (!Array.isArray(fields)) return out;
  for (const f of fields) {
    if (f?.kind === 'row') collectFieldIds(f.fields, out);
    else if (f?.id) out.push(f.id);
  }
  return out;
}
