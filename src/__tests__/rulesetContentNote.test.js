/**
 * The system picker tells the GM what a ruleset actually ships before
 * they commit to it. The answer is read from the ruleset registry, not
 * hardcoded per system, so a new ruleset gets a correct line for free.
 */
import { describe, it, expect } from 'vitest';
import { describeRulesetContent, getGameSystemPresets } from '../state/rulesets.js';

const presets = getGameSystemPresets();

describe('describeRulesetContent', () => {
  it('names the compendium for a system that ships one', () => {
    const note = describeRulesetContent('dnd5e', presets.dnd5e);
    expect(note).toMatch(/compendium/i);
  });

  it('lists the content a ruleset declares', () => {
    const note = describeRulesetContent('ose', presets.ose);
    expect(note).toMatch(/classes/i);
  });

  it('warns that a mechanics-only system ships no content', () => {
    for (const slug of ['gurps', 'wod', 'savage_worlds']) {
      const note = describeRulesetContent(slug, presets[slug]);
      expect(note, slug).toMatch(/mechanics/i);
      expect(note, slug).toMatch(/bring your own/i);
    }
  });

  it('never returns an empty line for an unknown ruleset', () => {
    expect(describeRulesetContent('nope', undefined).length).toBeGreaterThan(10);
  });
});
