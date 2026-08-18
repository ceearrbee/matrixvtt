/**
 * G2: `meta.spec_version` conformance hook.
 *
 * Validator accepts the current version silently; warns (not errors) when
 * the declared version is newer or malformed so third-party files don't
 * hard-fail on unknown fields as the spec evolves.
 */

import { describe, it, expect } from 'vitest';
import { validateRuleset, CURRENT_SPEC_VERSION } from '../engine/validateRuleset.js';

const baseValid = {
  meta: { name: 'Fixture' },
  attributes: [{ key: 'a', label: 'A' }],
  dice: { check: '1d20' },
};

describe('CURRENT_SPEC_VERSION', () => {
  it('is a semver string', () => {
    expect(typeof CURRENT_SPEC_VERSION).toBe('string');
    expect(CURRENT_SPEC_VERSION).toMatch(/^\d+\.\d+$/);
  });
});

describe('validateRuleset - spec_version handling', () => {
  it('ruleset without spec_version validates cleanly but warns', () => {
    const r = validateRuleset(baseValid);
    expect(r.valid).toBe(true);
    expect(r.warnings.some((w) => /spec_version/.test(w))).toBe(true);
  });

  it('ruleset with current spec_version validates clean (no warnings from versioning)', () => {
    const r = validateRuleset({ ...baseValid, meta: { name: 'x', spec_version: CURRENT_SPEC_VERSION } });
    expect(r.valid).toBe(true);
    expect(r.warnings.filter((w) => /spec_version/.test(w))).toEqual([]);
  });

  it('ruleset with a future spec_version loads with a warning', () => {
    const r = validateRuleset({ ...baseValid, meta: { name: 'x', spec_version: '9.0' } });
    expect(r.valid).toBe(true);
    expect(r.warnings.some((w) => /spec_version.*9\.0/.test(w))).toBe(true);
  });

  it('non-string spec_version errors out', () => {
    const r = validateRuleset({ ...baseValid, meta: { name: 'x', spec_version: 1.0 } });
    expect(r.valid).toBe(false);
  });
});
