/**
 * Spellcasting subsection - ability picker plus 9 spell-slot inputs.
 * Same gate as the Spells tab (SheetPanel.jsx): present only when the
 * ruleset declares spell_schools.
 */
import { h } from 'preact';

export function SpellcastingFields({ ui, entity, isPC, isEdit }) {
  const sc = ui.state.settings.systemConfig;
  const hasSpells = Array.isArray(sc?.spell_schools) && sc.spell_schools.length > 0;
  if (!hasSpells || sc?.hasSpellSystem === false) return null;
  const attrs = sc?.attributes || [{ key: 'int', label: 'INT' }];
  return h('div', null, [
    h('div', { class: 'section-header' }, 'Spellcasting (Optional)'),
    h('div', { class: 'form-row' },
      h('div', { class: 'form-group' }, [
        h('label', { class: 'form-label', for: 'entity-spellcasting-ability' }, 'Spellcasting Ability'),
        h('select', { class: 'form-select', id: 'entity-spellcasting-ability' }, [
          h('option', { value: '' }, '- None -'),
          ...attrs.map(a => h('option', { value: a.key, selected: isEdit && isPC && entity?.spellcasting_ability === a.key }, a.label)),
        ]),
      ])),
    h('div', { class: 'form-row', style: 'flex-wrap:wrap;gap:6px;' },
      [1,2,3,4,5,6,7,8,9].map(lvl => {
        const total = isEdit && isPC ? (entity?.spell_slots?.[String(lvl)]?.total ?? 0) : 0;
        return h('div', { class: 'form-group', style: 'flex:0 0 auto;min-width:60px;' }, [
          h('label', { class: 'form-label', for: `entity-spell-slots-${lvl}` }, `L${lvl}`),
          h('input', { type: 'number', class: 'form-input', id: `entity-spell-slots-${lvl}`, value: total, min: 0, max: 9, style: 'width:56px;' }),
        ]);
      })),
  ]);
}
