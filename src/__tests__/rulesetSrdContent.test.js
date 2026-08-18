/**
 * Openly-licensed SRD content shipped with the skeleton rulesets:
 * Fate Core skills and stunt patterns (CC-BY-3.0), generic PbtA basic
 * moves (original text), OpenD6 attribute skill lists (OGL 1.0a via
 * the D6 Adventure SRD), and B/X classes plus spell lists (OGL 1.0a
 * via the Old-School Essentials SRD). Every touched ruleset must
 * validate cleanly and carry meta.sources; OGL content requires the
 * license text at the repository root.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import fate from '../content/rulesets/fate.json';
import pbta from '../content/rulesets/pbta.json';
import opend6 from '../content/rulesets/opend6.json';
import ose from '../content/rulesets/ose.json';
import gurps from '../content/rulesets/gurps.json';
import wod from '../content/rulesets/wod.json';
import savageWorlds from '../content/rulesets/savage-worlds.json';
import { validateRuleset } from '../engine/validateRuleset.js';

const TOUCHED = { fate, pbta, opend6, ose, gurps, wod, savageWorlds };

const attributeKeys = (rs) => rs.attributes.map((a) => a.key);

const sheetKinds = (rs) => rs.character_sheet.sections.map((s) => s.kind);

describe('touched rulesets validate with zero errors', () => {
  for (const [name, rs] of Object.entries(TOUCHED)) {
    it(`${name} passes validateRuleset`, () => {
      const r = validateRuleset(rs);
      expect(r.errors).toEqual([]);
      expect(r.valid).toBe(true);
    });
  }
});

describe('touched rulesets declare license and sources', () => {
  for (const [name, rs] of Object.entries(TOUCHED)) {
    it(`${name} has meta.license and a well-formed meta.sources array`, () => {
      expect(typeof rs.meta.license).toBe('string');
      expect(rs.meta.license.length).toBeGreaterThan(0);
      expect(Array.isArray(rs.meta.sources)).toBe(true);
      for (const src of rs.meta.sources) {
        expect(typeof src.title).toBe('string');
        expect(typeof src.license).toBe('string');
        expect(typeof src.url).toBe('string');
      }
    });
  }
});

describe('fate: Fate Core skills and stunt patterns (CC-BY-3.0)', () => {
  it('ships the 18 Fate Core skills', () => {
    const keys = fate.skills.map((s) => s.key);
    expect(keys).toEqual([
      'athletics', 'burglary', 'contacts', 'crafts', 'deceive', 'drive',
      'empathy', 'fight', 'investigate', 'lore', 'notice', 'physique',
      'provoke', 'rapport', 'resources', 'shoot', 'stealth', 'will',
    ]);
    for (const s of fate.skills) {
      expect(typeof s.label).toBe('string');
      expect(typeof s.description).toBe('string');
    }
  });

  it('ships the three canonical stunt patterns', () => {
    expect(fate.stunts.length).toBeGreaterThanOrEqual(3);
    for (const st of fate.stunts) {
      expect(typeof st.label).toBe('string');
      expect(typeof st.pattern).toBe('string');
    }
  });

  it('renders skills and stunts on the character sheet', () => {
    expect(sheetKinds(fate)).toContain('skill_list');
    const stunts = fate.character_sheet.sections
      .find((s) => s.kind === 'tagged_list' && s.field === 'stunts');
    expect(stunts).toBeTruthy();
  });

  it('carries the Evil Hat CC-BY attribution', () => {
    expect(fate.meta.attribution).toMatch(/Evil Hat Productions/);
    expect(fate.meta.attribution).toMatch(/Creative Commons Attribution 3\.0/);
    expect(fate.meta.sources.length).toBeGreaterThanOrEqual(2);
  });
});

describe('pbta: generic basic moves (original scaffolding)', () => {
  it('ships at least six 2d6+stat basic moves keyed to declared stats', () => {
    expect(pbta.skills.length).toBeGreaterThanOrEqual(6);
    const attrs = attributeKeys(pbta);
    for (const move of pbta.skills) {
      expect(attrs).toContain(move.attribute);
      expect(move.description).toMatch(/10\+/);
      expect(move.description).toMatch(/7-9/);
    }
  });

  it('renders the moves with roll buttons on the character sheet', () => {
    const section = pbta.character_sheet.sections.find((s) => s.kind === 'skill_list');
    expect(section?.label).toBe('Basic Moves');
  });

  it('does not claim an open license for Apocalypse World text', () => {
    expect(pbta.meta.license).not.toMatch(/CC BY/i);
    expect(pbta.meta.attribution).toMatch(/D\. Vincent Baker/);
    expect(pbta.meta.attribution).toMatch(/Meguey Baker/);
  });
});

describe('opend6: D6 Adventure SRD skill lists (OGL 1.0a)', () => {
  it('ships the attribute-associated skill list', () => {
    expect(opend6.skills.length).toBeGreaterThanOrEqual(40);
    const attrs = attributeKeys(opend6);
    const keys = new Set();
    for (const s of opend6.skills) {
      expect(attrs).toContain(s.attribute);
      expect(typeof s.label).toBe('string');
      expect(keys.has(s.key)).toBe(false);
      keys.add(s.key);
    }
  });

  it('associates spot-check skills with the SRD attributes', () => {
    const byKey = Object.fromEntries(opend6.skills.map((s) => [s.key, s.attribute]));
    expect(byKey.melee_combat).toBe('reflexes');
    expect(byKey.sleight_of_hand).toBe('coordination');
    expect(byKey.swimming).toBe('physique');
    expect(byKey.scholar).toBe('knowledge');
    expect(byKey.tracking).toBe('perception');
    expect(byKey.willpower).toBe('presence');
  });

  it('renders the skills on the character sheet', () => {
    expect(sheetKinds(opend6)).toContain('skill_list');
  });
});

describe('ose: B/X classes and spell lists (OGL 1.0a)', () => {
  it('ships the seven core classes with prime requisites and hit dice', () => {
    expect(ose.classes.map((c) => c.key)).toEqual([
      'cleric', 'dwarf', 'elf', 'fighter', 'halfling', 'magic_user', 'thief',
    ]);
    const attrs = attributeKeys(ose);
    for (const c of ose.classes) {
      expect(typeof c.label).toBe('string');
      expect(c.hit_die).toMatch(/^d(4|6|8)$/);
      expect(c.prime_requisites.length).toBeGreaterThanOrEqual(1);
      for (const pr of c.prime_requisites) expect(attrs).toContain(pr);
    }
  });

  it('ships a strictly increasing XP table per class, starting at 0', () => {
    for (const c of ose.classes) {
      const table = ose.tables[c.xp_table];
      expect(table, `${c.key} xp table`).toBeTruthy();
      expect(table['1']).toBe(0);
      const values = Object.keys(table)
        .map(Number)
        .sort((a, b) => a - b)
        .map((lvl) => table[String(lvl)]);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
    }
  });

  it('ships cleric and magic-user spell lists for levels 1-3 by name', () => {
    expect(ose.spell_lists.cleric['1']).toHaveLength(8);
    expect(ose.spell_lists.cleric['2']).toHaveLength(8);
    expect(ose.spell_lists.cleric['3']).toHaveLength(6);
    expect(ose.spell_lists.magic_user['1']).toHaveLength(12);
    expect(ose.spell_lists.magic_user['2']).toHaveLength(12);
    expect(ose.spell_lists.magic_user['3']).toHaveLength(12);
    expect(ose.spell_lists.cleric['1']).toContain('Cure Light Wounds');
    expect(ose.spell_lists.magic_user['1']).toContain('Magic Missile');
    expect(ose.spell_lists.magic_user['3']).toContain('Fire Ball');
  });
});

describe('systems without an open SRD say so', () => {
  for (const name of ['gurps', 'wod', 'savageWorlds']) {
    it(`${name} declares itself a generic mechanics implementation`, () => {
      const rs = TOUCHED[name];
      expect(rs.meta.description).toMatch(/no open .*SRD/i);
      expect(rs.meta.sources).toEqual([]);
    });
  }
});

describe('license files at the repository root', () => {
  const read = (name) => readFileSync(`${process.cwd()}/${name}`, 'utf8');

  it('THIRD-PARTY-NOTICES.md covers every shipped ruleset', () => {
    const notices = read('THIRD-PARTY-NOTICES.md');
    for (const file of ['dnd5e', 'fate', 'gurps', 'opend6', 'ose', 'pbta', 'risus', 'savage-worlds', 'wod']) {
      expect(notices).toContain(`${file}.json`);
    }
    expect(notices).toMatch(/GURPS[\s\S]*no open SRD/i);
    expect(notices).toMatch(/World of Darkness[\s\S]*no open SRD/i);
  });
});
