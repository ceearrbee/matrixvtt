/**
 * FormField - schema-descriptor → label + input + inline error.
 *
 * Most forms in the
 * project mutate a modal's DOM post-submit via `applyFieldErrors` -
 * that path keeps working. This wrapper is for forms that want the
 * a11y wiring (aria-invalid, aria-describedby, role=alert,
 * .field--invalid) baked into the markup so an initial render with
 * an error state is correct without a separate sweep.
 *
 * Usage:
 *   h(FormField, {
 *     descriptor: { id: 'hp-max', label: 'HP Max', type: 'int',
 *                   required: true, min: 1 },
 *     value: 30,
 *     error: errors.hp_max,    // string | null | undefined
 *     onInput: (v) => …,
 *   });
 */

import { h } from 'preact';

function inputType(type) {
  if (type === 'int' || type === 'float') return 'number';
  if (type === 'bool') return 'checkbox';
  return 'text';
}

export function FormField({ descriptor, value, error, onInput }) {
  const id = descriptor.id;
  const errorId = `${id}-error`;
  const type = descriptor.type || 'text';
  const inputAttrs = {
    id,
    type: inputType(type),
    value: type === 'bool' ? undefined : (value ?? ''),
    checked: type === 'bool' ? !!value : undefined,
    class: `form-input${error ? ' field--invalid' : ''}`,
    onInput: onInput
      ? (e) => onInput(type === 'bool' ? e.target.checked : e.target.value)
      : undefined,
    ...(error ? { 'aria-invalid': 'true', 'aria-describedby': errorId } : {}),
    ...(descriptor.required ? { required: true } : {}),
    ...(typeof descriptor.min === 'number' ? { min: descriptor.min } : {}),
    ...(typeof descriptor.max === 'number' ? { max: descriptor.max } : {}),
  };

  return h('div', { class: 'form-group' }, [
    h('label', { class: 'form-label', for: id }, descriptor.label || id),
    h('input', inputAttrs),
    error && h('div', { id: errorId, class: 'form-error', role: 'alert' }, error),
  ]);
}
