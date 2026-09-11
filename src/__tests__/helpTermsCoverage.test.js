/**
 * HelpIcon and its term registry are the surviving contextual-help
 * mechanism, so they have to cover the jargon the tour used to explain
 * and the Matrix protocol vocabulary the UX critique flagged.
 */
import { describe, it, expect } from 'vitest';
import { HELP_TERMS } from '../ui/help-terms.js';

describe('help term registry', () => {
  it('covers the jargon a new user meets', () => {
    for (const term of ['ruleset', 'fog', 'initiative', 'ooc', 'scene', 'persona', 'prep', 'msgtype', 'tombstone']) {
      expect(HELP_TERMS, term).toHaveProperty(term);
    }
  });

  it('gives every term a short title and a longer explanation', () => {
    for (const [term, entry] of Object.entries(HELP_TERMS)) {
      expect(entry.short.length, term).toBeGreaterThan(20);
      expect(entry.long.length, term).toBeGreaterThan(80);
    }
  });

  it('explains the Matrix message types the composer exposes', () => {
    expect(HELP_TERMS.msgtype.long).toMatch(/m\.text/);
    expect(HELP_TERMS.msgtype.long).toMatch(/m\.emote/);
    expect(HELP_TERMS.msgtype.long).toMatch(/m\.notice/);
  });
});
