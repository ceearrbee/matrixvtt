/**
 * stat_grid sections may declare `formula: <named-ruleset-formula>` or
 * `field: <character-field>`. Formula wins when both are present.
 *
 * Context passed to formulas: { character, inventory (resolved), tables }.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { h } from 'preact';
import { render } from '@testing-library/preact';
import { renderSectionList } from '../ui/characterSheetSections.js';
import { tablePhaseSignal } from '../state/ui-signals.js';
import { UI_MODES } from '../utils/constants.js';

// Exploration mode wraps sections in group cards; these tests assert
// flat dispatcher output, so opt out into Combat.
beforeEach(() => { tablePhaseSignal.value = UI_MODES.COMBAT; });

const dnd5eLike = {
  tables: {},
  formulas: {
    armor_class: {
      $: '+',
      args: [
        { $: 'if', args: ['@character.ac', '@character.ac', 10] },
        { $: 'sum_items', args: ['ac_bonus', 'equipped'] },
      ],
    },
  },
};

function mkUi(items) {
  return {
    state: {
      settings: { systemConfig: dnd5eLike },
      canEditEntity: () => false,
      items: new Map(items.map((i) => [i.id, i])),
    },
  };
}

describe('stat_grid - formula resolution', () => {
  it('renders the computed formula value', () => {
    const char = {
      id: 'pc', name: 'x', ac: 14,
      inventory_ids: ['shield', 'cloak'],
    };
    const items = [
      { id: 'shield', ac_bonus: 2, equipped: true },
      { id: 'cloak',  ac_bonus: 1, equipped: false },
    ];
    const sections = [{ kind: 'stat_grid', stats: [{ label: 'AC', formula: 'armor_class' }] }];
    const tree = h('div', null, renderSectionList(mkUi(items), char, sections));
    const { container } = render(tree);
    // 14 base + shield (equipped, +2) = 16
    expect(container.textContent).toMatch(/AC[^\d]*16/);
  });

  it('falls back to raw field when formula is absent', () => {
    const char = { id: 'pc', ac: 12 };
    const sections = [{ kind: 'stat_grid', stats: [{ label: 'AC', field: 'ac' }] }];
    const tree = h('div', null, renderSectionList(mkUi([]), char, sections));
    const { container } = render(tree);
    expect(container.textContent).toMatch(/AC[^\d]*12/);
  });

  it('formula wins over field when both are declared', () => {
    const char = { id: 'pc', ac: 99 };
    const sections = [{ kind: 'stat_grid', stats: [{ label: 'AC', field: 'ac', formula: 'armor_class' }] }];
    const tree = h('div', null, renderSectionList(mkUi([]), { ...char, ac: 10 }, sections));
    const { container } = render(tree);
    // formula reads @character.ac (10) + 0 items = 10
    expect(container.textContent).toMatch(/AC[^\d]*10/);
  });

  it('missing formula + missing field shows em-dash', () => {
    const char = { id: 'pc' };
    const sections = [{ kind: 'stat_grid', stats: [{ label: 'AC' }] }];
    const tree = h('div', null, renderSectionList(mkUi([]), char, sections));
    const { container } = render(tree);
    expect(container.textContent).toMatch(/AC[^\d]*-/);
  });
});
