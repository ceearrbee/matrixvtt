/**
 * Conditions are rulebook content, so they belong to the ruleset.
 *
 * One sixteen-entry emoji map in utils served all nine systems, a
 * second eleven-name list was hardcoded in the condition dialog, and
 * dnd5e.json declared a third list that nothing read. A Savage Worlds
 * table got Exhausted and Hasted; a World of Darkness table got
 * neither its health levels nor anything resembling them.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getConditions, conditionLabel, conditionAbbr } from '../state/rulesets.js';

const RULESET_DIR = join(process.cwd(), 'src/content/rulesets');
const rulesets = readdirSync(RULESET_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => [f, JSON.parse(readFileSync(join(RULESET_DIR, f), 'utf8'))]);

describe('every ruleset brings its own conditions', () => {
  for (const [file, ruleset] of rulesets) {
    it(`${file} declares a condition vocabulary`, () => {
      expect(Array.isArray(ruleset.conditions), `${file} has no conditions`).toBe(true);
      expect(ruleset.conditions.length).toBeGreaterThan(0);
    });

    it(`${file} gives every condition a key, a label and an abbreviation`, () => {
      for (const c of ruleset.conditions) {
        expect(typeof c.key, `${file}`).toBe('string');
        expect(c.key).toMatch(/^[a-z0-9-]+$/);
        expect(typeof c.label).toBe('string');
        expect(c.label.length).toBeGreaterThan(0);
        expect(typeof c.abbr).toBe('string');
        expect(c.abbr.length).toBeGreaterThanOrEqual(1);
        expect(c.abbr.length).toBeLessThanOrEqual(2);
      }
    });

    it(`${file} keys and abbreviations are unique within the system`, () => {
      const keys = ruleset.conditions.map((c) => c.key);
      const abbrs = ruleset.conditions.map((c) => c.abbr);
      expect(new Set(keys).size).toBe(keys.length);
      expect(new Set(abbrs).size).toBe(abbrs.length);
    });

    it(`${file} carries no emoji in its condition abbreviations`, () => {
      for (const c of ruleset.conditions) {
        expect(c.abbr, `${file} ${c.key}`).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    });
  }

  it('gives different systems different vocabularies', () => {
    const byFile = Object.fromEntries(
      rulesets.map(([f, r]) => [f, r.conditions.map((c) => c.key).sort().join(',')]),
    );
    expect(byFile['savage-worlds.json']).not.toBe(byFile['dnd5e.json']);
    expect(byFile['wod.json']).not.toBe(byFile['dnd5e.json']);
  });
});

describe('reading conditions from the active ruleset', () => {
  const cfg = {
    conditions: [{ key: 'shaken', label: 'Shaken', abbr: 'Sh' }],
  };

  it('returns what the ruleset declares', () => {
    expect(getConditions(cfg).map((c) => c.key)).toEqual(['shaken']);
  });

  it('returns nothing for a ruleset that declares none', () => {
    expect(getConditions({})).toEqual([]);
    expect(getConditions(null)).toEqual([]);
  });

  it('names a declared condition', () => {
    expect(conditionLabel(cfg, 'shaken')).toBe('Shaken');
    expect(conditionAbbr(cfg, 'shaken')).toBe('Sh');
  });

  it('falls back to the raw key for a condition the system does not declare', () => {
    expect(conditionLabel(cfg, 'homebrewed')).toBe('homebrewed');
    expect(conditionAbbr(cfg, 'homebrewed')).toBe('H');
  });
});

describe('the old single source is gone', () => {
  it('utils/conditions.js no longer exists', () => {
    expect(() => readFileSync(join(process.cwd(), 'src/utils/conditions.js'), 'utf8')).toThrow();
  });
});
