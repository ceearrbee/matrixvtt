/**
 * ItemPicker - small reusable `<select>` over `ui.state.items`.
 * First option is the empty / unset state. Used in TableFormModal so
 * authors don't have to type item ids by hand.
 */
import { h } from 'preact';

/**
 * @param {{
 *   items: Map<string, { name?: string }>,
 *   value?: string | null,
 *   onChange: (id: string | null) => void,
 *   id?: string,
 *   ariaLabel?: string,
 * }} props
 */
export function ItemPicker(props) {
  const { items, value, onChange, id, ariaLabel } = props;
  const opts = [...(items?.entries?.() ?? [])].sort((a, b) =>
    (a[1].name ?? a[0]).localeCompare(b[1].name ?? b[0])
  );

  const exists = value != null && items?.has?.(value);
  const missingLabel = value && !exists ? `(missing: ${value})` : null;

  return h(
    'select',
    {
      id,
      class: 'form-input table-entry__item',
      'aria-label': ariaLabel ?? 'Linked item',
      value: value ?? '',
      onChange: e => {
        const v = e.target.value;
        onChange(v === '' ? null : v);
      },
    },
    [
      h('option', { value: '' }, '- none -'),
      missingLabel && h('option', { value, selected: true }, missingLabel),
      ...opts.map(([itemId, item]) =>
        h('option', { key: itemId, value: itemId }, item.name || itemId)
      ),
    ]
  );
}
