/**
 * Risus: The Anything RPG ruleset. Clichés are dice pools of d6s: write
 * the cliché's name in its slot, set its dice rating in the paired
 * attribute, and roll Nd6 against a target number. Combat damage is
 * losing dice, modeled as six one-point stress boxes.
 */
import { describe, it, expect } from 'vitest';
import risus from '../content/rulesets/risus.json';
import { getGameSystemPresets } from '../state/rulesets.js';
import { validateRuleset } from '../engine/validateRuleset.js';
import { rollNotation } from '../engine/roll.js';
import { applyHarm } from '../engine/applyHarm.js';

describe('Risus ruleset', () => {
  it('is registered in the built-in presets under the risus slug', () => {
    const presets = getGameSystemPresets();
    expect(presets.risus).toBeTruthy();
    expect(presets.risus.meta.name).toMatch(/risus/i);
  });

  it('passes validateRuleset with no errors', () => {
    const check = validateRuleset(risus);
    expect(check.valid, check.errors.join(', ')).toBe(true);
  });

  it('cliché ratings are d6 pools: a 4-die cliché rolls 4d6', () => {
    expect(risus.rolls.attribute).toBe('{bonus}d6');
    const roll = rollNotation('4d6', { rng: () => 0.5 });
    expect(roll.rolls).toHaveLength(4);
  });

  it('combat damage is lost dice: six one-point stress boxes', () => {
    expect(risus.harm_model).toEqual({ type: 'stress', boxes: [1, 1, 1, 1, 1, 1] });
    const hit = applyHarm(risus.harm_model, { stress: [false, false, false, false, false, false] }, 1);
    expect(hit.stress.filter(Boolean)).toHaveLength(1);
  });

  it('sheet pairs cliché name slots with cliché dice attributes', () => {
    const sections = risus.character_sheet.sections;
    const slotList = sections.find((s) => s.kind === 'slot_list' && s.field === 'cliches');
    expect(slotList.slots.map((s) => s.key)).toEqual(
      risus.attributes.map((a) => a.key),
    );
    expect(sections.some((s) => s.kind === 'attributes')).toBe(true);
    expect(sections.some((s) => s.kind === 'tagged_list' && s.field === 'hooks')).toBe(true);
    expect(sections.some((s) => s.kind === 'resource_pool' && s.field === 'lucky_shots')).toBe(true);
  });

  it('declares preview blocks like the other built-ins', () => {
    expect(risus.character_preview?.sections?.length).toBeGreaterThan(0);
    expect(risus.npc_preview?.sections?.length).toBeGreaterThan(0);
    expect(risus.item_preview?.sections?.length).toBeGreaterThan(0);
  });
});

describe('Risus edit form and preview labels', () => {
  it('declares a character_form so Edit Character can set cliche dice', () => {
    const kinds = risus.character_form.fields.map((f) => f.kind);
    expect(kinds).toContain('attributes');
  });

  it('previews label the damage track as lost dice, not generic stress', () => {
    for (const block of [risus.character_preview, risus.npc_preview]) {
      const track = block.sections.find((s) => s.kind === 'box_track');
      expect(track?.label).toMatch(/dice/i);
      expect(block.sections.some((s) => s.kind === 'stress_boxes')).toBe(false);
    }
  });
});

describe('Risus roll templates never crash the roller', () => {
  it('every template expanded with a zero pool still rolls', () => {
    for (const template of Object.values(risus.rolls)) {
      const notation = template.replace(/\{(bonus|mod|score)\}/g, '0');
      expect(() => rollNotation(notation, { rng: () => 0.5 }), notation).not.toThrow();
    }
  });

  it('initiative is a flat die, not a zero-able pool', () => {
    expect(risus.rolls.initiative).toBe('1d6');
  });
});
