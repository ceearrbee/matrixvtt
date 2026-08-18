
import { h } from 'preact';
import { rowKey } from '../../utils/row-key.js';

export function initialVariants(token) {
  if (!token || !Array.isArray(token.variants)) return [];
  return token.variants.map((v) => ({
    _key: rowKey(),
    label: String(v?.label ?? ''),
    image_url: String(v?.image_url ?? ''),
  }));
}

export function VariantListEditor({ variants, addVariant, removeVariant, updateVariant, applyVariant }) {
  const empty = variants.length === 0;
  return h('div', { class: 'form-group', role: 'group', 'aria-label': 'Token variants' }, [
    h('div', {
      class: 'form-label',
      style: 'display:flex;justify-content:space-between;align-items:center;gap:var(--space-md);',
    }, [
      h('span', null, 'Variants'),
      h('span', { class: 'form-help', style: 'font-weight:400;' },
        'Alternate portraits (bloodied, dead, transformed, …). "Use" swaps the live image on save.'),
    ]),
    !empty && h('ul', {
      class: 'narrative-list',
      'aria-label': `${variants.length} variant${variants.length === 1 ? '' : 's'} configured`,
    }, variants.map((v, i) => h('li', {
      key: v._key ?? i,
      class: 'narrative-list__row',
      style: 'gap:var(--space-md);flex-wrap:wrap;',
    }, [
      h('label', { class: 'sr-only', for: `variant-${i}-label` }, `Variant ${i + 1} label`),
      h('input', {
        type: 'text',
        id: `variant-${i}-label`,
        class: 'form-input',
        placeholder: 'Label (e.g. Bloodied)',
        value: v.label,
        style: 'flex:1;min-width:120px;',
        'aria-label': `Variant ${i + 1} label`,
        onInput: (e) => updateVariant(i, { label: e.currentTarget.value }),
      }),
      h('label', { class: 'sr-only', for: `variant-${i}-url` }, `Variant ${i + 1} image URL`),
      h('input', {
        type: 'text',
        id: `variant-${i}-url`,
        class: 'form-input',
        placeholder: 'mxc://… or https://…',
        value: v.image_url,
        style: 'flex:2;min-width:160px;',
        'aria-label': `Variant ${i + 1} image URL`,
        onInput: (e) => updateVariant(i, { image_url: e.currentTarget.value }),
      }),
      h('button', {
        type: 'button',
        class: 'dbt dbt--sm',
        'aria-label': `Use variant ${i + 1}`,
        title: 'Swap the live portrait to this variant',
        disabled: !v.image_url,
        onClick: () => applyVariant(i),
      }, 'Use'),
      h('button', {
        type: 'button',
        class: 'dbt dbt--sm dbt--ghost',
        'aria-label': `Remove variant ${i + 1}`,
        onClick: () => removeVariant(i),
      }, 'Remove'),
    ]))),
    empty && h('div', { class: 'narrative-list__empty' }, 'No variants.'),
    h('button', {
      type: 'button',
      class: 'dbt dbt--sm',
      onClick: addVariant,
    }, '+ Add variant'),
  ]);
}
