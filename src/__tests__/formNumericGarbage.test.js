/**
 * A number field that was typed into but cannot be read is an error,
 * not a blank.
 *
 * `readForValidation` mapped both "" and "abc" to `undefined`, which is
 * right for the blank - a required field then fails with "required"
 * rather than a misleading min-bound message. For "abc" it was wrong in
 * two ways: on an optional field `undefined` passes validation, and the
 * value that got persisted came from `getInt`'s `parseInt(v) || 0`. So
 * a typo in an optional number silently became 0 while validation
 * believed the field was untouched.
 *
 * Blank still reads as untouched. Unreadable now reaches the schema as
 * what the user actually typed, so the type check rejects it and
 * applyFieldErrors points at the field.
 */
import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import { FormReader } from '../utils/forms.js';
import { optInt, intRange } from '../utils/form-schemas.js';

function form(html) {
  const modal = document.createElement('div');
  modal.innerHTML = html;
  return new FormReader(modal);
}

const FIELDS = { hp_max: { id: 'hp_max', type: 'int' }, speed: { id: 'speed', type: 'float' } };
const SCHEMA = v.object({ hp_max: optInt('HP Max', 0, 999), speed: optInt('Speed', 0, 999) });

describe('unreadable numbers are errors, not blanks', () => {
  it('rejects a typo in an optional number instead of storing 0', () => {
    const { values, errors } = form('<input id="hp_max" value="abc"><input id="speed" value="">')
      .validate(FIELDS, SCHEMA);
    expect(errors.hp_max).toBeTruthy();
    expect(values.hp_max).not.toBe(0);
  });

  it('still treats a blank number as untouched, not as an error', () => {
    const { errors } = form('<input id="hp_max" value=""><input id="speed" value="">')
      .validate(FIELDS, SCHEMA);
    expect(errors).toEqual({});
  });

  it('still reports a blank required number as required', () => {
    const required = v.object({ hp_max: intRange('HP Max', 1, 999, { required: true }) });
    const { errors } = form('<input id="hp_max" value="">')
      .validate({ hp_max: FIELDS.hp_max }, required);
    expect(errors.hp_max).toMatch(/required/i);
  });

  it('accepts a number that reads cleanly', () => {
    const { values, errors } = form('<input id="hp_max" value="42"><input id="speed" value="30">')
      .validate(FIELDS, SCHEMA);
    expect(errors).toEqual({});
    expect(values.hp_max).toBe(42);
  });

  it('rejects trailing junk rather than silently keeping the prefix', () => {
    const { errors } = form('<input id="hp_max" value="3x"><input id="speed" value="">')
      .validate(FIELDS, SCHEMA);
    expect(errors.hp_max).toBeTruthy();
  });
});

describe('a blank number is unset, not zero', () => {
  it('reports a cleared optional number as null so callers can default it', () => {
    const { values, errors } = form('<input id="hp_max" value=""><input id="speed" value="">')
      .validate(FIELDS, SCHEMA);
    expect(errors).toEqual({});
    // `data.strength ?? 10` in the character wizard, and every other
    // `?? default` downstream, only fires on null - a 0 silently wins.
    expect(values.hp_max).toBeNull();
    expect(values.speed).toBeNull();
  });

  it('keeps a real zero, which is a number the user typed', () => {
    const { values } = form('<input id="hp_max" value="0"><input id="speed" value="">')
      .validate(FIELDS, SCHEMA);
    expect(values.hp_max).toBe(0);
  });
});
