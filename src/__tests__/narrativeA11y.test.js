/**
 * Locks in accessibility/UX polish on the narrative primitives:
 * - proper <label>/for associations for inputs
 * - role+aria-label on groups
 * - fieldset/legend grouping for multi-track box_track
 * - aria-live on the resource_pool value
 * - pending_modifiers_list shows the running total in its header
 * - Clear all is hidden when there's only one pending entry
 *
 * If any of these regress, this file fails - keeps the polish from
 * decaying as someone refactors.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/preact';
import { _kindsForTest } from '../ui/characterSheetSections.js';

function makeUi({ updateCharacter = vi.fn(), harmModel } = {}) {
  return {
    updateCharacter,
    state: {
      canEditEntity: () => true,
      isGM: () => true,
      settings: { systemConfig: harmModel ? { harm_model: harmModel } : {} },
    },
    widgetManager: { userId: '@me:hs' },
    chat: { announceMessage: vi.fn() },
  };
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('a11y polish - tagged_list (editable)', () => {
  it('Add input has an associated <label> (sr-only allowed)', () => {
    const ui = makeUi();
    const { container } = render(_kindsForTest.tagged_list({
      ui,
      character: { id: 'c1', aspects: [] },
      config: { kind: 'tagged_list', field: 'aspects', label: 'Aspects', editable: true, placeholder: 'Add aspect…' },
    }));
    const input = container.querySelector('input[type="text"]');
    expect(input.id).toBeTruthy();
    const lbl = container.querySelector(`label[for="${input.id}"]`);
    expect(lbl).toBeTruthy();
  });

  it('section uses <section aria-labelledby> pointing at the header', () => {
    const ui = makeUi();
    const { container } = render(_kindsForTest.tagged_list({
      ui,
      character: { id: 'c1', aspects: ['A'] },
      config: { kind: 'tagged_list', field: 'aspects', label: 'Aspects' },
    }));
    const section = container.querySelector('section.narrative-section');
    expect(section).toBeTruthy();
    const labelledBy = section.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(container.querySelector(`#${labelledBy}`)).toBeTruthy();
  });
});

describe('a11y polish - slot_list', () => {
  it('each slot input has an associated <label>', () => {
    const ui = makeUi();
    const { container } = render(_kindsForTest.slot_list({
      ui,
      character: { id: 'c1' },
      config: { kind: 'slot_list', field: 'consequences', label: 'Consequences',
        slots: [{ key: 'mild', label: 'Mild' }, { key: 'severe', label: 'Severe' }] },
    }));
    const inputs = container.querySelectorAll('input[type="text"]');
    expect(inputs.length).toBe(2);
    for (const inp of inputs) {
      expect(inp.id).toBeTruthy();
      expect(container.querySelector(`label[for="${inp.id}"]`)).toBeTruthy();
    }
  });
});

describe('a11y polish - box_track', () => {
  it('multi-track renders fieldset+legend per track', () => {
    const ui = makeUi();
    const { container } = render(_kindsForTest.box_track({
      ui,
      character: { id: 'c1' },
      config: {
        kind: 'box_track', field: 'stress', label: 'Stress',
        tracks: [
          { name: 'Physical', capacities: [1, 2, 3] },
          { name: 'Mental',   capacities: [1, 2, 3] },
        ],
      },
    }));
    const fieldsets = container.querySelectorAll('fieldset.narrative-track');
    expect(fieldsets.length).toBe(2);
    expect(fieldsets[0].querySelector('legend').textContent).toBe('Physical');
    expect(fieldsets[1].querySelector('legend').textContent).toBe('Mental');
  });
});

describe('a11y polish - resource_pool', () => {
  it('value span has aria-live polite for live announcements', () => {
    const ui = makeUi();
    const { container } = render(_kindsForTest.resource_pool({
      ui,
      character: { id: 'c1', fate_points: 3 },
      config: { kind: 'resource_pool', field: 'fate_points', label: 'Fate' },
    }));
    const value = container.querySelector('.narrative-pool__value');
    expect(value).toBeTruthy();
    expect(value.getAttribute('aria-live')).toBe('polite');
  });

  it('shows current/max when max_field is configured', () => {
    const ui = makeUi();
    const { container } = render(_kindsForTest.resource_pool({
      ui,
      character: { id: 'c1', fate_points: 2, fate_max: 5 },
      config: { kind: 'resource_pool', field: 'fate_points', label: 'Fate', max_field: 'fate_max' },
    }));
    expect(container.querySelector('.narrative-pool__value').textContent).toBe('2 / 5');
  });
});

describe('a11y polish - pending_modifiers_list', () => {
  it("header shows running total ('+N on next roll')", () => {
    const ui = makeUi();
    const { container } = render(_kindsForTest.pending_modifiers_list({
      ui,
      character: { id: 'c1', pending_modifiers: [
        { value: 2, source: 'A' },
        { value: 3, source: 'B' },
      ]},
      config: { kind: 'pending_modifiers_list', label: 'Pending' },
    }));
    const header = container.querySelector('.section-header');
    expect(header.textContent).toMatch(/\+5/);
    expect(header.textContent).toMatch(/next roll/i);
  });

  it("'Clear all' hidden with only one pending entry", () => {
    const ui = makeUi();
    const { container } = render(_kindsForTest.pending_modifiers_list({
      ui,
      character: { id: 'c1', pending_modifiers: [{ value: 2, source: 'A' }]},
      config: { kind: 'pending_modifiers_list' },
    }));
    const buttons = Array.from(container.querySelectorAll('button')).map((b) => b.textContent);
    expect(buttons).not.toContain('Clear all');
  });
});
