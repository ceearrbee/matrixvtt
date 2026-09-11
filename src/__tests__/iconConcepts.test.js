/**
 * One icon, one concept.
 *
 * Four icons carried more than one meaning, and two were inverted
 * between surfaces: in the create menu the single-person glyph meant
 * *your character* and the group glyph meant *NPC*, while in the
 * companion tabs the single-person glyph meant *NPCs* and the group
 * glyph meant *Party*. A user who learned one surface was actively
 * misled by the other. `WrenchIcon` meant both the prep workspace and
 * Skills; `BookIcon` meant Journal, Spell, Page and Spells.
 *
 * The fix is a registry rather than a scan: concepts pick their icon
 * from one map, so a collision is a duplicate value, not a drift
 * between two files nobody reads together.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CONCEPT_ICONS } from '../ui/icons/index.jsx';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('concept icon registry', () => {
  it('names every concept that had a colliding icon', () => {
    expect(Object.keys(CONCEPT_ICONS).sort()).toEqual(
      ['character', 'journal', 'npc', 'party', 'prep', 'skill', 'spell'],
    );
  });

  it('gives each concept an icon of its own', () => {
    const used = Object.values(CONCEPT_ICONS);
    expect(new Set(used).size, 'two concepts share one icon').toBe(used.length);
  });

  it('routes the create menu and the companion tabs through the registry', () => {
    for (const f of ['src/ui/NewEntityMenu.jsx', 'src/ui/RightCompanion.jsx']) {
      expect(read(f), f).toMatch(/CONCEPT_ICONS/);
    }
  });

  it('agrees on which glyph means character and which means NPC', () => {
    const menu = read('src/ui/NewEntityMenu.jsx');
    const tabs = read('src/ui/RightCompanion.jsx');
    expect(menu).toMatch(/label: 'Character', Icon: CONCEPT_ICONS\.character/);
    expect(menu).toMatch(/label: 'NPC', Icon: CONCEPT_ICONS\.npc/);
    expect(tabs).toMatch(/CONCEPT_ICONS\.npc, 'NPCs'/);
    expect(tabs).toMatch(/CONCEPT_ICONS\.party, 'Party'/);
  });

  it('leaves the wrench to the prep workspace alone', () => {
    expect(read('src/ui/RightCompanion.jsx')).not.toMatch(/WrenchIcon/);
    expect(read('src/ui/Header.jsx')).toMatch(/WrenchIcon/);
  });
});
