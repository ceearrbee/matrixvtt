/**
 * Ruleset-driven character-sheet composition.
 *
 * The ruleset's `character_sheet.sections[]` lists which blocks the sheet
 * renders and in what order. Each entry is `{ kind, ...config }`.
 * Unknown kinds render nothing (not an error - forward compatibility).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h } from 'preact';
import { render } from '@testing-library/preact';
import { renderSectionList } from '../ui/characterSheetSections.js';
import { tablePhaseSignal } from '../state/ui-signals.js';
import { UI_MODES } from '../utils/constants.js';

beforeEach(() => { tablePhaseSignal.value = UI_MODES.COMBAT; });

function mkUi(overrides = {}) {
  return {
    state: {
      settings: { systemConfig: overrides.ruleset ?? {} },
      canEditEntity: () => false,
      items: new Map(),
    },
    _deriveCharacterSaves: () => ({}),
    ...overrides.ui,
  };
}

const character = {
  id: 'c1',
  name: 'Test',
  attributes: { str: 10, dex: 14 },
  hp_current: 12,
  hp_max: 20,
  speed: 30,
  conditions: ['poisoned'],
  notes: 'Some notes.',
  stress: [false, true, false],
  aspects: ['Hot-headed', 'Honour before glory'],
};

describe('renderSectionList', () => {
  it('returns empty array for missing or empty sections', () => {
    expect(renderSectionList(mkUi(), character, undefined)).toEqual([]);
    expect(renderSectionList(mkUi(), character, [])).toEqual([]);
  });

  it('unknown kinds produce no nodes and do not throw', () => {
    const out = renderSectionList(mkUi(), character, [{ kind: 'martian_ray' }]);
    expect(out).toHaveLength(0);
  });

  it('notes kind renders when character has notes', () => {
    const out = renderSectionList(mkUi(), character, [{ kind: 'notes' }]);
    expect(out).toHaveLength(1);
  });

  it('notes kind renders header + "no notes yet" when the field is empty', () => {
    // Returning null makes the whole Notes section vanish. Always
    // render the header so users understand the structure of the
    // sheet.
    const out = renderSectionList(mkUi(), { ...character, notes: '' }, [{ kind: 'notes' }]);
    expect(out).toHaveLength(1);
  });

  it('conditions kind always renders (shows "None active" when empty)', () => {
    const out = renderSectionList(mkUi(), { ...character, conditions: [] }, [{ kind: 'conditions' }]);
    expect(out).toHaveLength(1);
  });

  it('renders multiple sections in order', () => {
    const out = renderSectionList(mkUi(), character, [
      { kind: 'conditions' },
      { kind: 'notes' },
    ]);
    expect(out).toHaveLength(2);
  });
});

describe('section kinds - DOM output', () => {
  it('stress_boxes renders one checkbox per declared box', () => {
    const ui = mkUi({ ruleset: { harm_model: { type: 'stress', boxes: [1, 2, 3] } } });
    const tree = h('div', null, renderSectionList(ui, character, [{ kind: 'stress_boxes' }]));
    const { container } = render(tree);
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(3);
    // character.stress = [false, true, false]
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(true);
    expect(checkboxes[2].checked).toBe(false);
  });

  it('aspects renders one row per aspect string', () => {
    const tree = h('div', null, renderSectionList(mkUi(), character, [{ kind: 'aspects' }]));
    const { container } = render(tree);
    expect(container.textContent).toContain('Hot-headed');
    expect(container.textContent).toContain('Honour before glory');
  });

  it('resource_track renders a progress bar with current/max label', () => {
    const sections = [{ kind: 'resource_track', id: 'hp', label: 'HP', current_field: 'hp_current', max_field: 'hp_max' }];
    const ui = { ...mkUi(), setHP: vi.fn(), adjustHP: vi.fn() };
    const tree = h('div', null, renderSectionList(ui, character, sections));
    const { container } = render(tree);
    expect(container.textContent).toMatch(/HP/);
    expect(container.textContent).toMatch(/12.*20/);
  });

  it('spell_book renders nothing when empty and viewer cannot edit', () => {
    // A viewer (not owner, not GM) of a character with no prepared
    // spells gains nothing from a "No spells prepared." banner.
    // Suppress for read-only viewers; editors keep the empty state as
    // an authoring affordance.
    const noSpells = { ...character, spell_ids: [] };
    const out = renderSectionList(mkUi(), noSpells, [{ kind: 'spell_book' }]);
    const { container } = render(h('div', null, out));
    expect(container.textContent).not.toMatch(/No spells prepared/);
    expect(container.textContent.trim()).toBe('');
  });

  it('spell_book DOES render the empty state when the viewer can edit', () => {
    const ui = { ...mkUi(), state: { ...mkUi().state, canEditEntity: () => true } };
    const noSpells = { ...character, spell_ids: [] };
    const out = renderSectionList(ui, noSpells, [{ kind: 'spell_book' }]);
    const { container } = render(h('div', null, out));
    expect(container.textContent).toMatch(/No spells prepared/);
  });

  it('inventory_summary renders nothing when empty and viewer cannot edit', () => {
    const noItems = { ...character, inventory_ids: [] };
    const out = renderSectionList(mkUi(), noItems, [{ kind: 'inventory_summary' }]);
    const { container } = render(h('div', null, out));
    expect(container.textContent.trim()).toBe('');
  });

  it('currency renders nothing when ruleset has no denominations and viewer cannot edit', () => {
    const out = renderSectionList(mkUi(), character, [{ kind: 'currency' }]);
    const { container } = render(h('div', null, out));
    expect(container.textContent.trim()).toBe('');
  });

  it('action_list escapes action.damage so HTML is rendered as text, not parsed', () => {
    // Regression: action.damage was interpolated raw into a string passed to
    // dangerouslySetInnerHTML. A GM (or any author of the NPC entity) could
    // inject script-bearing markup and execute it in every viewer's client.
    const evil = '<img src=x onerror="window.__pwned=1">';
    const npc = {
      ...character,
      actions: [{ name: 'Bite', damage: evil, description: 'A nasty bite.' }],
    };
    const tree = h('div', null, renderSectionList(mkUi(), npc, [{ kind: 'action_list' }]));
    const { container } = render(tree);
    // The raw text must appear verbatim - no <img> element materialised.
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain(evil);
  });
});
