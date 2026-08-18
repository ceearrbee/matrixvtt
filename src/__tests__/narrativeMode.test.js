/**
 * isNarrativeMode reads three sources, in precedence order:
 *   1. settings.narrative_mode_override === 'on' | 'off'  (GM force)
 *   2. settings.systemConfig.narrative                    (ruleset flag)
 *   3. false                                              (tactical default)
 *
 * The override is tri-state so 'auto' (the implicit `undefined`) means
 * "inherit from the ruleset" - a plain boolean cannot represent that.
 */
import { describe, it, expect } from 'vitest';
import { isNarrativeMode } from '../utils/narrative-mode.js';

const tactical = { settings: { systemConfig: { narrative: false } } };
const narrative = { settings: { systemConfig: { narrative: true } } };
const unflagged = { settings: { systemConfig: {} } };

describe('isNarrativeMode', () => {
  it('returns true when the ruleset is flagged narrative and no override is set', () => {
    expect(isNarrativeMode(narrative)).toBe(true);
  });

  it('returns false when the ruleset is tactical and no override is set', () => {
    expect(isNarrativeMode(tactical)).toBe(false);
  });

  it("treats a missing 'narrative' field as tactical", () => {
    expect(isNarrativeMode(unflagged)).toBe(false);
  });

  it("'on' override forces narrative even on a tactical ruleset", () => {
    const s = { settings: { systemConfig: { narrative: false }, narrative_mode_override: 'on' } };
    expect(isNarrativeMode(s)).toBe(true);
  });

  it("'off' override forces tactical even on a narrative ruleset", () => {
    const s = { settings: { systemConfig: { narrative: true }, narrative_mode_override: 'off' } };
    expect(isNarrativeMode(s)).toBe(false);
  });

  it("'auto' override (or any other value) defers to the ruleset", () => {
    const s = { settings: { systemConfig: { narrative: true }, narrative_mode_override: 'auto' } };
    expect(isNarrativeMode(s)).toBe(true);
  });

  it('survives missing settings / systemConfig / state without throwing', () => {
    expect(isNarrativeMode(null)).toBe(false);
    expect(isNarrativeMode({})).toBe(false);
    expect(isNarrativeMode({ settings: {} })).toBe(false);
    expect(isNarrativeMode({ settings: { systemConfig: null } })).toBe(false);
  });
});
