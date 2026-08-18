/**
 * FormField a11y wiring.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, h } from 'preact';
import { FormField } from '../ui/forms/FormField.jsx';

function mount(props) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  render(h(FormField, props), root);
  return root;
}

describe('FormField', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('renders a labelled input bound to the descriptor id', () => {
    const root = mount({
      descriptor: { id: 'hp-max', label: 'HP Max', type: 'int', required: true, min: 1 },
      value: 30,
    });
    const input = root.querySelector('#hp-max');
    expect(input).not.toBeNull();
    expect(input.type).toBe('number');
    expect(input.required).toBe(true);
    expect(root.querySelector('label[for="hp-max"]').textContent).toBe('HP Max');
  });

  it('wires aria-invalid + aria-describedby + role=alert when error is set', () => {
    const root = mount({
      descriptor: { id: 'hp-max', label: 'HP Max', type: 'int' },
      value: '',
      error: 'HP Max is required',
    });
    const input = root.querySelector('#hp-max');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('hp-max-error');
    const errorEl = root.querySelector('#hp-max-error');
    expect(errorEl).not.toBeNull();
    expect(errorEl.getAttribute('role')).toBe('alert');
    expect(errorEl.textContent).toBe('HP Max is required');
    expect(input.classList.contains('field--invalid')).toBe(true);
  });

  it('omits error wiring when error is null', () => {
    const root = mount({
      descriptor: { id: 'name', label: 'Name' },
      value: 'Aria',
      error: null,
    });
    const input = root.querySelector('#name');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    expect(root.querySelector('#name-error')).toBeNull();
  });

  it('handles boolean fields as checkboxes', () => {
    const root = mount({
      descriptor: { id: 'is-hidden', label: 'Hidden', type: 'bool' },
      value: true,
    });
    const input = root.querySelector('#is-hidden');
    expect(input.type).toBe('checkbox');
    expect(input.checked).toBe(true);
  });
});
