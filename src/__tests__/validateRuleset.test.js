/**
 * Ruleset validator. Third-party rulesets are user-imported JSON; the
 * validator catches malformed files before the engine tries to use them.
 *
 * Returns { valid: boolean, errors: string[], warnings: string[] }.
 * Non-throwing - importers show the messages to the user.
 */

import { describe, it, expect } from 'vitest';
import { validateRuleset } from '../engine/validateRuleset.js';
import dnd5e from '../content/rulesets/dnd5e.json';
import fate from '../content/rulesets/fate.json';
import gurps from '../content/rulesets/gurps.json';

describe('validateRuleset - shipped fixtures all pass', () => {
  it('dnd5e.json validates', () => {
    const r = validateRuleset(dnd5e);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('fate.json validates', () => {
    expect(validateRuleset(fate).valid).toBe(true);
  });

  it('gurps.json validates', () => {
    expect(validateRuleset(gurps).valid).toBe(true);
  });
});

describe('validateRuleset - required fields', () => {
  it('rejects missing meta.name', () => {
    const r = validateRuleset({ attributes: [{ key: 'a', label: 'A' }], dice: { check: '1d20' } });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => /meta\.name/.test(e))).toBe(true);
  });

  it('rejects empty attributes', () => {
    const r = validateRuleset({ meta: { name: 'x' }, attributes: [], dice: { check: '1d20' } });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => /attributes/.test(e))).toBe(true);
  });

  it('rejects attributes without key or label', () => {
    const r = validateRuleset({
      meta: { name: 'x' },
      attributes: [{ key: 'a' }], // missing label
      dice: { check: '1d20' },
    });
    expect(r.valid).toBe(false);
  });

  it('rejects missing dice.check', () => {
    const r = validateRuleset({ meta: { name: 'x' }, attributes: [{ key: 'a', label: 'A' }] });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => /dice\.check/.test(e))).toBe(true);
  });

  it('rejects non-object input', () => {
    expect(validateRuleset(null).valid).toBe(false);
    expect(validateRuleset('oops').valid).toBe(false);
    expect(validateRuleset(42).valid).toBe(false);
  });
});

describe('validateRuleset - formula AST', () => {
  const base = {
    meta: { name: 'x' },
    attributes: [{ key: 'a', label: 'A' }],
    dice: { check: '1d20' },
  };

  it('accepts well-formed formulas', () => {
    expect(validateRuleset({
      ...base,
      formulas: { f: { $: '+', args: [1, '@x', { $: 'floor', args: [3.5] }] } },
    }).valid).toBe(true);
  });

  it('rejects unknown operators', () => {
    const r = validateRuleset({
      ...base,
      formulas: { f: { $: 'evil_exec', args: [] } },
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => /unknown op|evil_exec/.test(e))).toBe(true);
  });

  it('rejects formulas with args that are not an array', () => {
    const r = validateRuleset({
      ...base,
      formulas: { f: { $: '+', args: 'not-an-array' } },
    });
    expect(r.valid).toBe(false);
  });

  it('allows nested formulas', () => {
    const r = validateRuleset({
      ...base,
      formulas: {
        f: { $: 'max', args: [{ $: '+', args: [1, 2] }, { $: 'lookup', args: ['t', '@x'] }] },
      },
    });
    expect(r.valid).toBe(true);
  });
});

describe('validateRuleset - harm_model', () => {
  const base = {
    meta: { name: 'x' },
    attributes: [{ key: 'a', label: 'A' }],
    dice: { check: '1d20' },
  };

  it('accepts pool with track_key', () => {
    expect(validateRuleset({ ...base, harm_model: { type: 'pool', track_key: 'hp' } }).valid).toBe(true);
  });

  it('rejects pool without track_key', () => {
    const r = validateRuleset({ ...base, harm_model: { type: 'pool' } });
    expect(r.valid).toBe(false);
  });

  it('accepts tracks with array', () => {
    expect(validateRuleset({ ...base, harm_model: { type: 'tracks', tracks: ['hp', 'fp'] } }).valid).toBe(true);
  });

  it('accepts stress with boxes array', () => {
    expect(validateRuleset({ ...base, harm_model: { type: 'stress', boxes: [1, 2, 3] } }).valid).toBe(true);
  });

  it('rejects unknown harm_model type', () => {
    const r = validateRuleset({ ...base, harm_model: { type: 'explosions' } });
    expect(r.valid).toBe(false);
  });
});

describe('validateRuleset - warnings', () => {
  it('warns when formulas reference a table not declared in tables', () => {
    const r = validateRuleset({
      meta: { name: 'x' },
      attributes: [{ key: 'a', label: 'A' }],
      dice: { check: '1d20' },
      formulas: { f: { $: 'lookup', args: ['ghost_table', '@x'] } },
      tables: { other: { 1: 2 } },
    });
    expect(r.valid).toBe(true); // warnings don't fail validation
    expect(r.warnings.some((w) => /ghost_table/.test(w))).toBe(true);
  });
});

describe('new-block validation (player-authored rulesets)', () => {
  const base = {
    meta: { name: 'Custom', spec_version: '1.0' },
    attributes: [{ key: 'guts', label: 'Guts' }],
    dice: { check: '1d10' },
  };

  it('flags overlay entries without a kind in token and character_card blocks', () => {
    const rs = {
      ...base,
      token: { overlays: [{ field: 'stress' }] },
      character_card: { overlays: [{ kind: 'pip_track' }, { field: 'x' }] },
    };
    const check = validateRuleset(rs);
    expect(check.errors.join('\n')).toContain('token.overlays[0].kind');
    expect(check.errors.join('\n')).toContain('character_card.overlays[1].kind');
  });

  it('flags preview sections without a kind', () => {
    const rs = { ...base, character_preview: { sections: [{ field: 'hooks' }] } };
    const check = validateRuleset(rs);
    expect(check.errors.join('\n')).toContain('character_preview.sections[0].kind');
  });

  it('validates character_form field shapes', () => {
    const rs = {
      ...base,
      character_form: { fields: [{ id: 'notes' }, { kind: 'row' }] },
    };
    const check = validateRuleset(rs);
    const all = check.errors.join('\n');
    expect(all).toContain('character_form.fields[0].kind');
    expect(all).toContain('character_form.fields[1].fields');
  });

  it('validates combat.common_actions and action_economy shapes', () => {
    const rs = {
      ...base,
      combat: { common_actions: [{ description: 'no label' }] },
      action_economy: [{ key: 'action_used' }],
    };
    const check = validateRuleset(rs);
    const all = check.errors.join('\n');
    expect(all).toContain('combat.common_actions[0].label');
    expect(all).toContain('action_economy[0].title');
  });

  it('accepts an empty action_economy and well-formed new blocks', () => {
    const rs = {
      ...base,
      action_economy: [],
      token: { overlays: [{ kind: 'pip_track', field: 'stress', count: 6 }] },
      character_card: { overlays: [{ kind: 'text', field: 'pools' }] },
      character_form: { fields: [{ kind: 'attributes' }, { kind: 'row', fields: [{ kind: 'text', id: 'motto', label: 'Motto' }] }] },
      combat: { common_actions: [{ label: 'Strike' }] },
      character_preview: { sections: [{ kind: 'attributes' }] },
    };
    const check = validateRuleset(rs);
    expect(check.valid, check.errors.join(', ')).toBe(true);
  });
});
