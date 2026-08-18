/**
 * AttributeInputs - shared Preact component rendering the entity-form
 * attribute grid (three columns, per the ruleset's `attributes[]` list).
 *
 * Consumed by EntityForm.jsx and characterFormFields.js's
 * `attributes` section. Replaces the legacy `renderAttributeInputs`
 * string-template. IDs preserved (`entity-attr-<key>`, `data-attr-key`)
 * so existing FormReader / collectAttributeValues contracts still work.
 */
import { h } from 'preact';

// 10 is the d20 baseline; when the ruleset's range excludes it (Risus
// cliché dice run 0-6) fall back to the attribute's own minimum.
function defaultValue(a) {
  if (a.default != null) return a.default;
  const lo = a.min ?? 1;
  const hi = a.max ?? 999;
  return lo <= 10 && 10 <= hi ? 10 : lo;
}

export function AttributeInputs({ ui, existing, class: cls = 'stats-grid stats-grid--3col' }) {
  const attrs = ui.state.settings.systemConfig?.attributes || [];
  const rows = [];
  for (let i = 0; i < attrs.length; i += 3) rows.push(attrs.slice(i, i + 3));
  return h('div', { class: cls },
    rows.map((row, ri) => h('div', { class: 'form-row', key: row[0]?.key ?? `row-${ri}` },
      row.map((a) => h('div', { class: 'form-group', key: a.key }, [
        h('label', { class: 'form-label', for: `entity-attr-${a.key}` }, a.label),
        h('input', {
          type: 'number', class: 'form-input entity-attr',
          id: `entity-attr-${a.key}`, 'data-attr-key': a.key,
          value: existing?.[a.key] ?? defaultValue(a),
          min: a.min ?? 1, max: a.max ?? 999,
        }),
      ])))));
}
