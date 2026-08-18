/**
 * Collapse-by-default is the standard for non-current non-expanded
 * initiative rows. The active row always shows the full layout. The
 * chevron toggle is the explicit expand affordance. Mode does not gate
 * any of this - the layout is the same in every UI mode.
 */
import { describe, it, expect, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent } from '@testing-library/preact';

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    DndContext: (props) => h('div', null, props.children),
    useSensor: vi.fn(),
    useSensors: vi.fn(() => []),
    PointerSensor: {},
    KeyboardSensor: {},
  };
});

vi.mock('@dnd-kit/sortable', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useSortable: vi.fn(() => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: undefined,
      isDragging: false,
    })),
    SortableContext: (props) => h('div', null, props.children),
    sortableKeyboardCoordinates: vi.fn(),
    verticalListSortingStrategy: vi.fn(),
  };
});

import { InitiativeBar } from '../ui/InitiativeBar.jsx';

function mkUi({ order, isGM = true }) {
  const tokens = new Map(order.map((e) => [e.token_id, {
    id: e.token_id, sheet_id: `pc-${e.token_id}`, color: '#888',
    conditions: ['poisoned'], ac: 15,
  }]));
  return {
    state: {
      initiative: { active: true, round: 1, current_index: 0, order },
      tokens, characters: new Map(), npcs: new Map(),
      settings: { systemConfig: {} },
      fog: { mode: null, revealed: [] },
      isGM: () => isGM,
      isTokenVisibleToPlayer: () => true,
      widgetManager: { userId: '@me:hs' },
    },
    reorderInitiative: vi.fn(),
    _isMyCombatTurn: () => false,
    previewToken: vi.fn(),
  };
}

function rows(container) {
  return Array.from(container.querySelectorAll('[data-token-id]'));
}

describe('initiative - row collapse', () => {
  const order = [
    { token_id: 't-aria', name: 'Aria', hp_current: 28, hp_max: 40, initiative: 18 },
    { token_id: 't-finn', name: 'Finn', hp_current: 35, hp_max: 35, initiative: 11 },
  ];

  it('inactive row hides AC + conditions by default', () => {
    const { container } = render(h(InitiativeBar, { ui: mkUi({ order }) }));
    const inactiveRow = rows(container).find((r) => r.getAttribute('data-token-id') === 't-finn');
    expect(inactiveRow.querySelector('.ie__ac')).toBeNull();
    expect(inactiveRow.querySelector('.ie__conditions')).toBeNull();
    expect(inactiveRow.querySelectorAll('.ie__hp-adjust-btn').length).toBe(0);
    // HP bar always stays visible
    expect(inactiveRow.querySelector('.ie__hp-bar')).not.toBeNull();
  });

  it('active row keeps the full layout', () => {
    const { container } = render(h(InitiativeBar, { ui: mkUi({ order }) }));
    const activeRow = rows(container).find((r) => r.getAttribute('data-token-id') === 't-aria');
    expect(activeRow.querySelector('.ie__ac')).not.toBeNull();
    expect(activeRow.querySelectorAll('.ie__hp-adjust-btn').length).toBeGreaterThan(0);
  });

  it('clicking the chevron toggle on an inactive row expands it', () => {
    const { container } = render(h(InitiativeBar, { ui: mkUi({ order }) }));
    const inactiveRow = rows(container).find((r) => r.getAttribute('data-token-id') === 't-finn');
    const chevron = inactiveRow.querySelector('.ie__expand-toggle');
    fireEvent.click(chevron);
    const reread = rows(container).find((r) => r.getAttribute('data-token-id') === 't-finn');
    expect(reread.querySelector('.ie__ac')).not.toBeNull();
  });
});
