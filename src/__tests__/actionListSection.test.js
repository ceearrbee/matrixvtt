/**
 * K3: `action_list` section kind reads an arbitrary character field and
 * renders it as a titled list of action cards. Lets NPC sheets declare
 * legendary / lair / traits blocks without adding new section kinds for
 * each one.
 *
 * The existing `actions` kind keeps working as an alias (field='actions',
 * title='Actions').
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { h } from 'preact';
import { render } from '@testing-library/preact';
import { renderSectionList } from '../ui/characterSheetSections.js';
import { tablePhaseSignal } from '../state/ui-signals.js';
import { UI_MODES } from '../utils/constants.js';

beforeEach(() => { tablePhaseSignal.value = UI_MODES.COMBAT; });

function mkUi() {
  return { state: { settings: { systemConfig: {} }, canEditEntity: () => false } };
}

describe('action_list kind', () => {
  it('reads the configured field and renders a card per entry', () => {
    const character = {
      id: 'g',
      legendary_actions: [
        { name: 'Tail Swipe', description: 'Sweeps a 10-foot radius.' },
        { name: 'Wing Buffet', description: 'Knocks back adjacent.' },
      ],
    };
    const sections = [{ kind: 'action_list', field: 'legendary_actions', title: 'Legendary Actions' }];

    const tree = h('div', null, renderSectionList(mkUi(), character, sections));
    const { container } = render(tree);

    expect(container.textContent).toContain('Legendary Actions');
    expect(container.textContent).toContain('Tail Swipe');
    expect(container.textContent).toContain('Wing Buffet');
  });

  it('renders the header + a "no X yet" placeholder when the field is empty or missing', () => {
    // Returning null makes the whole section invisible to the user
    // (the ActionList vanishes for actionless NPCs). Render the
    // header + an explanatory line instead.
    const sections = [{ kind: 'action_list', field: 'lair_actions', title: 'Lair Actions' }];
    const empty = renderSectionList(mkUi(), { id: 'g', lair_actions: [] }, sections);
    expect(empty).toHaveLength(1);
    const absent = renderSectionList(mkUi(), { id: 'g' }, sections);
    expect(absent).toHaveLength(1);
    const tree = h('div', null, empty);
    const { container } = render(tree);
    expect(container.textContent).toContain('Lair Actions');
    expect(container.textContent.toLowerCase()).toContain('no lair actions');
  });

  it('defaults field to "actions" and title to "Actions"', () => {
    const character = { id: 'g', actions: [{ name: 'Bite', description: '1d6 piercing.' }] };
    const sections = [{ kind: 'action_list' }];
    const tree = h('div', null, renderSectionList(mkUi(), character, sections));
    const { container } = render(tree);
    expect(container.textContent).toContain('Actions');
    expect(container.textContent).toContain('Bite');
  });

  it('existing "actions" kind keeps working (back-compat alias)', () => {
    const character = { id: 'g', actions: [{ name: 'Bite' }] };
    const tree = h('div', null, renderSectionList(mkUi(), character, [{ kind: 'actions' }]));
    const { container } = render(tree);
    expect(container.textContent).toContain('Bite');
  });

  it('three action_list entries render three distinct blocks', () => {
    const character = {
      id: 'lich',
      actions:          [{ name: 'Paralyzing Touch' }],
      legendary_actions: [{ name: 'Cantrip' }],
      lair_actions:     [{ name: 'Spirits of the dead' }],
      traits:           [{ name: 'Rejuvenation' }],
    };
    const sections = [
      { kind: 'action_list' },
      { kind: 'action_list', field: 'legendary_actions', title: 'Legendary Actions' },
      { kind: 'action_list', field: 'lair_actions',      title: 'Lair Actions' },
      { kind: 'action_list', field: 'traits',            title: 'Traits' },
    ];
    const tree = h('div', null, renderSectionList(mkUi(), character, sections));
    const { container } = render(tree);

    const headers = [...container.querySelectorAll('.section-header')].map((e) => e.textContent);
    expect(headers).toEqual(['Actions', 'Legendary Actions', 'Lair Actions', 'Traits']);
  });
});
