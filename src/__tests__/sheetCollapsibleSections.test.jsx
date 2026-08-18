/**
 * Low-frequency reference sections (coinage, personality, notes) are
 * collapsed by default so the sheet leads with what a GM touches during
 * play (HP, actions, vitals) instead of presenting 9 equal-weight blocks.
 * Collapse uses a native <details>/<summary> so it stays keyboard- and
 * screen-reader-accessible with no JS state.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup } from '@testing-library/preact';
import dnd5e from '../content/rulesets/dnd5e.json';
import { renderSectionList } from '../ui/characterSheetSections.js';

afterEach(() => cleanup());

const kindsWith = (pred) =>
  dnd5e.character_sheet.sections.filter(pred).map((s) => s.kind);

describe('dnd5e sheet collapses trailing reference sections', () => {
  it('marks coinage, personality, and notes collapsed', () => {
    const collapsed = new Set(
      dnd5e.character_sheet.sections.filter((s) => s.collapsed).map((s) => s.kind)
    );
    expect(collapsed.has('currency')).toBe(true);
    expect(collapsed.has('personality')).toBe(true);
    expect(collapsed.has('notes')).toBe(true);
  });

  it('leaves the play-critical sections expanded (not collapsed)', () => {
    const alwaysOpen = kindsWith((s) => !s.collapsed).filter((k) =>
      ['resource_track', 'play_actions', 'stat_grid'].includes(k)
    );
    expect(alwaysOpen).toEqual(expect.arrayContaining(['resource_track', 'play_actions', 'stat_grid']));
  });
});

describe('renderSectionList wraps collapsed sections in <details>', () => {
  const character = { id: 'c1', name: 'Aria', notes: 'A note' };
  const ui = { state: { canEditEntity: () => true, settings: { systemConfig: {} } } };

  it('a collapsed section renders a closed <details> with a <summary> label', () => {
    const tree = h('div', null, renderSectionList(ui, character, [
      { kind: 'notes', collapsed: true, label: 'Notes' },
    ]));
    const { container } = render(tree);
    const details = container.querySelector('details');
    expect(details).not.toBeNull();
    expect(details.hasAttribute('open')).toBe(false);
    expect(details.querySelector('summary').textContent).toContain('Notes');
  });

  it('uses a section title (not just label) as the summary for action lists', () => {
    const tree = h('div', null, renderSectionList(ui, { id: 'n1', name: 'Dragon', traits: [] }, [
      { kind: 'action_list', field: 'traits', title: 'Traits', collapsed: true },
    ]));
    const { container } = render(tree);
    const details = container.querySelector('details');
    expect(details).not.toBeNull();
    expect(details.querySelector('summary').textContent).toContain('Traits');
  });

  it('a normal section is not wrapped in <details>', () => {
    const tree = h('div', null, renderSectionList(ui, character, [{ kind: 'notes' }]));
    const { container } = render(tree);
    expect(container.querySelector('details')).toBeNull();
  });
});
