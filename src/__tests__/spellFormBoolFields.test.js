/**
 * Regression: the spell form's `concentration` and `ritual` checkboxes
 * must be declared with `type: 'bool'` so FormReader reads
 * `field.checked` (a boolean) instead of `field.value` (a string).
 * Without it the Valibot spell schema rejects the resulting event.
 */
import { describe, it, expect } from 'vitest';
import { FormReader } from '../utils/forms.js';
import { getSpellFormSchema } from '../ui/spells-tab.js';

function makeForm({ concentration, ritual }) {
  const form = document.createElement('form');
  form.innerHTML = `
    <input type="text" id="spell-name" value="Bless">
    <input type="checkbox" id="spell-concentration" ${concentration ? 'checked' : ''}>
    <input type="checkbox" id="spell-ritual" ${ritual ? 'checked' : ''}>
  `;
  return form;
}

describe('spell form bool fields', () => {
  it('production schema declares concentration as bool', () => {
    expect(getSpellFormSchema().fields.concentration).toMatchObject({ id: 'spell-concentration', type: 'bool' });
  });

  it('production schema declares ritual as bool', () => {
    expect(getSpellFormSchema().fields.ritual).toMatchObject({ id: 'spell-ritual', type: 'bool' });
  });

  it('reads booleans from the form, not strings', () => {
    const data = new FormReader(makeForm({ concentration: true, ritual: false })).collect(getSpellFormSchema().fields);
    expect(data.concentration).toBe(true);
    expect(data.ritual).toBe(false);
  });
});
