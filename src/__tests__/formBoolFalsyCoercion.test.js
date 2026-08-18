/**
 * Regression lock: form-schema fields for checkboxes must declare
 * `type: 'bool'`.
 *
 * Without the bool declaration, FormReader falls back to
 * `.value || ''` and nullify, which produces strings like 'on' /
 * 'false' / null instead of booleans. The Valibot schemas downstream
 * reject these silently in some cases, hard-fail in others.
 *
 * Existing itemFormEquipped/spellFormBoolFields tests pin the checked
 * vs unchecked happy path. This test exercises adversarial falsy
 * `.value` attributes that would mislead the non-bool path, and
 * contrasts with a same-shape non-bool schema to prove the fix.
 */
import { describe, it, expect } from 'vitest';
import { FormReader } from '../utils/forms.js';

function checkbox(id, { checked, value } = {}) {
  const f = document.createElement('form');
  const i = document.createElement('input');
  i.type = 'checkbox';
  i.id = id;
  if (checked) i.checked = true;
  if (value !== undefined) i.setAttribute('value', value);
  f.appendChild(i);
  return f;
}

describe('FormReader bool coercion - falsy input regression', () => {
  it('returns false (not "" or null) for an unchecked box with empty value attr', () => {
    const form = checkbox('flag', { checked: false, value: '' });
    const data = new FormReader(form).collect({ flag: { id: 'flag', type: 'bool' } });
    expect(data.flag).toBe(false);
  });

  it('returns false (not "0") for an unchecked box with value="0"', () => {
    const form = checkbox('flag', { checked: false, value: '0' });
    const data = new FormReader(form).collect({ flag: { id: 'flag', type: 'bool' } });
    expect(data.flag).toBe(false);
  });

  it('returns true (not "false") for a checked box with value="false"', () => {
    const form = checkbox('flag', { checked: true, value: 'false' });
    const data = new FormReader(form).collect({ flag: { id: 'flag', type: 'bool' } });
    expect(data.flag).toBe(true);
  });

  it('contrast: forgetting type:"bool" silently breaks for an unchecked box (this is the bug we lock against)', () => {
    const form = checkbox('flag', { checked: false, value: '' });
    const data = new FormReader(form).collect({ flag: 'flag' });
    // Without bool, an unchecked empty-value checkbox nullifies to null,
    // which is not a boolean - that's the pitfall. If this assertion
    // ever changes, the schema-declared bool type is no longer needed.
    expect(typeof data.flag).not.toBe('boolean');
  });
});
