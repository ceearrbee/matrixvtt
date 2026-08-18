/**
 * AuraListEditor - visible radii drawn around a token (spell range,
 * aura of protection, etc.). Each row is { radius, color }.
 * Extracted from TokenFormModal.
 */

import { h } from 'preact';
import { TOKEN_COLORS } from '../../utils/ui-constants.js';
import { rowKey } from '../../utils/row-key.js';

// Seed the aura editor from whichever shape the token has on it:
//   1. New `auras: [{radius, color}]` array - used as-is.
//   2. Legacy `aura_radius`/`aura_color` - promoted to a one-row list.
//   3. Neither - empty (no auras).
export function initialAuras(token) {
  if (!token) return [];
  if (Array.isArray(token.auras) && token.auras.length > 0) {
    return token.auras.map((a) => ({
      _key: rowKey(),
      radius: Number(a?.radius) || 0,
      color: a?.color || TOKEN_COLORS.AURA_DEFAULT,
    }));
  }
  const legacyR = Number(token.aura_radius) || 0;
  if (legacyR > 0) {
    return [{ _key: rowKey(), radius: legacyR, color: token.aura_color || TOKEN_COLORS.AURA_DEFAULT }];
  }
  return [];
}

export function AuraListEditor({ auras, addAura, removeAura, updateAura }) {
  const empty = auras.length === 0;
  return h('div', { class: 'form-group', role: 'group', 'aria-label': 'Token auras' }, [
    h('div', {
      class: 'form-label',
      style: 'display:flex;justify-content:space-between;align-items:center;gap:var(--space-md);',
    }, [
      h('span', null, 'Auras'),
      h('span', { class: 'form-help', style: 'font-weight:400;' },
        'Visible radii drawn around the token (spell range, aura of protection, etc.).'),
    ]),
    !empty && h('ul', {
      class: 'narrative-list',
      'aria-label': `${auras.length} aura${auras.length === 1 ? '' : 's'} configured`,
    }, auras.map((a, i) => h('li', {
      key: a._key ?? i,
      class: 'narrative-list__row',
      style: 'gap:var(--space-md);',
    }, [
      h('label', {
        class: 'sr-only',
        for: `aura-${i}-radius`,
      }, `Aura ${i + 1} radius in cells`),
      h('input', {
        type: 'number',
        id: `aura-${i}-radius`,
        class: 'form-input',
        min: 0, max: 30, step: 1,
        value: a.radius,
        style: 'width:88px;',
        'aria-label': `Aura ${i + 1} radius (cells)`,
        onInput: (e) => updateAura(i, { radius: parseInt(e.currentTarget.value, 10) || 0 }),
      }),
      h('span', { class: 'form-help', style: 'min-width:32px;' }, 'cells'),
      h('label', {
        class: 'sr-only',
        for: `aura-${i}-color`,
      }, `Aura ${i + 1} colour`),
      h('input', {
        type: 'color',
        id: `aura-${i}-color`,
        class: 'form-input',
        value: a.color,
        style: 'height:32px;width:48px;padding:2px;',
        'aria-label': `Aura ${i + 1} colour`,
        onInput: (e) => updateAura(i, { color: e.currentTarget.value }),
      }),
      h('button', {
        type: 'button',
        class: 'dbt dbt--sm dbt--ghost',
        'aria-label': `Remove aura ${i + 1}`,
        onClick: () => removeAura(i),
      }, 'Remove'),
    ]))),
    empty && h('div', { class: 'narrative-list__empty' }, 'No auras.'),
    h('button', {
      type: 'button',
      class: 'dbt dbt--sm',
      onClick: addAura,
    }, '+ Add aura'),
  ]);
}
