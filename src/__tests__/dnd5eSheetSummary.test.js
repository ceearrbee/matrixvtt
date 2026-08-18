/**
 * The D&D 5e character sheet is a SUMMARY, not a wall of every list.
 * The full spellbook, skill list, and inventory live in their own
 * sub-tabs (Spells / Skills / Items), which render because the ruleset
 * declares spell_schools and skills. Listing those same lists on the
 * sheet too is the duplication that made the panel feel "too busy".
 */
import { describe, it, expect } from 'vitest';
import dnd5e from '../content/rulesets/dnd5e.json';

const sheetKinds = () => dnd5e.character_sheet.sections.map((s) => s.kind);

describe('dnd5e sheet is a summary (no duplicated full lists)', () => {
  it('omits the full spellbook / skill / inventory lists from the sheet', () => {
    const kinds = sheetKinds();
    expect(kinds).not.toContain('spell_book');
    expect(kinds).not.toContain('skill_list');
    expect(kinds).not.toContain('inventory_summary');
  });

  it('keeps the summary essentials on the sheet', () => {
    const kinds = sheetKinds();
    expect(kinds).toContain('resource_track'); // HP
    expect(kinds).toContain('play_actions'); // turn-action surface
    expect(kinds).toContain('stat_grid');
    expect(kinds).toContain('attributes');
    expect(kinds).toContain('saves');
  });

  it('still has a home for spells and skills (the sub-tabs render)', () => {
    // The Spells / Skills sub-tabs are gated on these being non-empty;
    // without them, removing the sheet sections would strand content.
    expect(Array.isArray(dnd5e.spell_schools) && dnd5e.spell_schools.length).toBeGreaterThan(0);
    expect(Array.isArray(dnd5e.skills) && dnd5e.skills.length).toBeGreaterThan(0);
  });
});

describe('npc sheet collapses reference/situational stat-block groups', () => {
  const npcKinds = () => dnd5e.npc_sheet.sections;
  const collapsed = () =>
    new Set(npcKinds().filter((s) => s.collapsed).map((s) => s.title ?? s.kind));

  it('collapses Traits, Lair Actions, and Notes by default', () => {
    const c = collapsed();
    expect(c.has('Traits')).toBe(true);
    expect(c.has('Lair Actions')).toBe(true);
    const notes = npcKinds().find((s) => s.kind === 'notes');
    expect(notes?.collapsed).toBe(true);
  });

  it('keeps the per-round combat blocks (Actions, Legendary Actions) expanded', () => {
    const open = npcKinds().filter((s) => !s.collapsed).map((s) => s.title);
    expect(open).toContain('Actions');
    expect(open).toContain('Legendary Actions');
  });
});

describe('previews are a peek, not a clone of the full sheet', () => {
  const kinds = (block) => block.sections.map((s) => s.kind);

  it('character_preview is a compact vitals glance (HP + a few stats), not the deep reference sections', () => {
    const k = kinds(dnd5e.character_preview);
    expect(k).toContain('resource_track'); // HP
    expect(k.length).toBeLessThanOrEqual(4);
    // saves + full attribute grid are open-the-sheet depth, not a glance.
    expect(k).not.toContain('saves');
    expect(k).not.toContain('attributes');
  });

  it('npc_preview does not embed the full stat block (action lists live on the sheet)', () => {
    const k = kinds(dnd5e.npc_preview);
    expect(k).toContain('resource_track');
    expect(k).not.toContain('action_list');
    expect(k.length).toBeLessThanOrEqual(4);
  });
});
