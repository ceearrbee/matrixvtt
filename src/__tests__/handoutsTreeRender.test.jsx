/**
 * Handouts tree render - asserts that the Handouts component renders
 * child handouts nested inside a .handout-children container under
 * their parent, rather than as flat siblings.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, h } from 'preact';
import { handoutsSignal } from '../state/signals.js';
import { Handouts } from '../ui/Handouts.jsx';

function makeUi(handoutsMap) {
  return {
    state: {
      isGM: () => true,
      handouts: handoutsMap,
    },
    _toast: () => {},
    showHandoutModal: () => {},
    showHandoutForm: () => {},
    toggleHandoutVisibility: () => {},
    deleteHandout: () => {},
  };
}

describe('<Handouts> tree rendering', () => {
  let host;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    render(null, host);
    host.remove();
    handoutsSignal.value = new Map();
  });

  it('renders a child handout inside .handout-children of its parent', () => {
    const handoutsMap = new Map([
      ['h1', { id: 'h1', title: 'Parent Handout', visible_to_players: true, created_at: 2 }],
      ['h2', { id: 'h2', title: 'Child Handout', parent_id: 'h1', visible_to_players: true, created_at: 1 }],
    ]);
    handoutsSignal.value = handoutsMap;

    render(h(Handouts, { ui: makeUi(handoutsMap) }), host);

    // Find the handout-children container
    const childrenContainer = host.querySelector('.handout-children');
    expect(childrenContainer).toBeTruthy();

    // The child title should appear inside .handout-children
    expect(childrenContainer.textContent).toContain('Child Handout');

    // The parent title should appear in the outer container (not just inside .handout-children)
    const parentNode = host.querySelector('.handout-node');
    expect(parentNode?.textContent).toContain('Parent Handout');
  });

  it('renders root handouts flat when no parent_id is set', () => {
    const handoutsMap = new Map([
      ['h1', { id: 'h1', title: 'Root A', visible_to_players: true, created_at: 2 }],
      ['h2', { id: 'h2', title: 'Root B', visible_to_players: true, created_at: 1 }],
    ]);
    handoutsSignal.value = handoutsMap;

    render(h(Handouts, { ui: makeUi(handoutsMap) }), host);

    // No nesting - no .handout-children should be rendered
    expect(host.querySelector('.handout-children')).toBeNull();
    // Both titles appear
    expect(host.textContent).toContain('Root A');
    expect(host.textContent).toContain('Root B');
  });
});
