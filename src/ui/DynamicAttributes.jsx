/**
 * DynamicAttributes - Preact replacement for `renderDynamicAttributes`.
 * Renders ruleset-driven attribute blocks (STR/DEX/CON/…) with value
 * and calculated modifier. Click-to-roll is wired via onClick so no
 * data-attribute event delegation is needed.
 */
import { h } from 'preact';
import { calcModifier } from './character-calculations.js';
import { pairedSlotField } from './attribute-pairing.js';

const DEFAULT_ATTRS = [
  { key: 'str', label: 'STR', default: 10 },
  { key: 'dex', label: 'DEX', default: 10 },
  { key: 'con', label: 'CON', default: 10 },
  { key: 'int', label: 'INT', default: 10 },
  { key: 'wis', label: 'WIS', default: 10 },
  { key: 'cha', label: 'CHA', default: 10 },
];

export function DynamicAttributes({ ui, attributes, character = null, onRoll = null }) {
  const safe = attributes || {};
  const systemConfig = ui.state.settings.systemConfig;
  const attrs = systemConfig?.attributes || DEFAULT_ATTRS;
  const slotField = pairedSlotField(systemConfig);
  const slotNames = slotField ? (character?.[slotField] ?? {}) : null;
  const roll = onRoll ?? ((label, value) => ui.rollAttributeCheck?.(label, value));

  return h('div', { class: 'stats-grid stats-grid--3col' },
    attrs.map((def) => {
      const value = safe[def.key] ?? def.default;
      const slotName = slotNames?.[def.key];
      // In paired systems an unnamed slot at the minimum is an unused
      // slot, not a stat - leave it off the sheet.
      if (slotNames && !slotName && value === (def.min ?? 0)) return null;
      const label = slotName || def.label;
      const mod = calcModifier(systemConfig, value);
      const modStr = mod === null ? '' : (mod >= 0 ? `+${mod}` : `${mod}`);
      return h('div', {
        key: def.key,
        class: 'ab',
        style: 'cursor:pointer;',
        title: `Click to roll ${label} check`,
        'data-roll-attribute-label': label,
        'data-roll-attribute-value': value,
        onClick: () => roll(label, value),
      }, [
        h('div', { class: 'ab__label' }, label),
        h('div', { class: 'ab__value' }, value),
        h('div', { class: 'ab__mod' }, modStr),
      ]);
    }));
}
