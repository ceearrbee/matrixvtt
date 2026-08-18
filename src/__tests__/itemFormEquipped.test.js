/**
 * The item form's `equipped` checkbox must serialize as a boolean so the
 * Valibot item schema accepts the resulting `com.vtt.item` event.
 * Previously the form-schema entry was a plain string id, which made
 * FormReader read `.value` (a string) instead of `.checked` (a boolean),
 * and the syncer rejected the event with "Item equipped must be boolean".
 */
import { describe, it, expect } from 'vitest';
import { FormReader } from '../utils/forms.js';
import { getItemFormSchema } from '../ui/items-tab.js';

function makeForm(checked) {
  const form = document.createElement('form');
  form.innerHTML = `
    <input type="text" id="item-name" value="Sword">
    <input type="checkbox" id="item-equipped" ${checked ? 'checked' : ''}>
  `;
  return form;
}

describe('item form equipped field', () => {
  it('reads equipped as a boolean when the checkbox is checked', () => {
    const form = makeForm(true);
    const data = new FormReader(form).collect({
      name: 'item-name',
      equipped: { id: 'item-equipped', type: 'bool' },
    });
    expect(data.equipped).toBe(true);
    expect(typeof data.equipped).toBe('boolean');
  });

  it('reads equipped as a boolean when the checkbox is unchecked', () => {
    const form = makeForm(false);
    const data = new FormReader(form).collect({
      name: 'item-name',
      equipped: { id: 'item-equipped', type: 'bool' },
    });
    expect(data.equipped).toBe(false);
    expect(typeof data.equipped).toBe('boolean');
  });

  it('the production items-tab schema declares equipped as bool', () => {
    const { fields } = getItemFormSchema();
    expect(fields.equipped).toMatchObject({ id: 'item-equipped', type: 'bool' });
  });
});
