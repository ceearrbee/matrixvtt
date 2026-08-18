/**
 * The GM-side HP-adjust cluster on
 * each initiative row showed (−5, −1, +1, +5). For inactive rows that's
 * four buttons of noise; for the active row those quick nudges matter.
 *
 * Active row: full cluster (4 buttons). Inactive row: just (−1, +1).
 */
import { describe, it, expect, vi } from 'vitest';
import { h } from 'preact';
import { render } from '@testing-library/preact';

// Match the dnd-kit mocks the existing initiativeSortable test uses -
// dnd-kit ships as React and trips happy-dom when rendered through Preact.
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
  };
});

import { InitiativeEntry } from '../ui/InitiativeEntry.jsx';

const ACTION_ECONOMY = [
  { key: 'action_used', label: 'A', title: 'Action' },
];

function mkUi(token) {
  return {
    state: {
      tokens: new Map([[token.id, token]]),
      characters: new Map(),
      npcs: new Map(),
      settings: { systemConfig: { movement: { unitsPerCell: 5, defaultSpeed: 30 } } },
      initiative: { order: [], current_index: 0 },
      widgetManager: { userId: '@gm:x' },
    },
    previewToken: () => {},
  };
}

function renderEntry({ isCurrent, isExpanded = false }) {
  const token = { id: 't1', sheet_id: 'pc-1', color: '#f80', conditions: [], ac: 15 };
  const entry = {
    token_id: 't1',
    name: 'Aria',
    hp_current: 28, hp_max: 40,
    initiative: 18,
  };
  const ui = mkUi(token);
  return render(
    h(InitiativeEntry, {
      ui, entry,
      index: 0,
      current_index: isCurrent ? 0 : 1,
      isGM: true,
      myTurn: isCurrent,
      actionEconomy: ACTION_ECONOMY,
      getHPPercentage: () => 70,
      isExpanded,
      onExpand: () => {},
    })
  );
}

describe('initiative row - HP-adjust cluster', () => {
  it('active row shows four buttons (−5, −1, +1, +5)', () => {
    const { container } = renderEntry({ isCurrent: true });
    const labels = Array.from(container.querySelectorAll('.ie__hp-adjust-btn')).map((b) => b.textContent);
    expect(labels).toEqual(['-5', '-1', '+1', '+5']);
  });

  it('inactive collapsed row hides all HP buttons (Phase 2 of cohesive-shell pass)', () => {
    const { container } = renderEntry({ isCurrent: false, isExpanded: false });
    expect(container.querySelectorAll('.ie__hp-adjust-btn').length).toBe(0);
  });

  it('inactive expanded row shows the two micro-adjusts (−1, +1)', () => {
    const { container } = renderEntry({ isCurrent: false, isExpanded: true });
    const labels = Array.from(container.querySelectorAll('.ie__hp-adjust-btn')).map((b) => b.textContent);
    expect(labels).toEqual(['-1', '+1']);
  });
});
