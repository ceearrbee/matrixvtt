/**
 * Initiative tracker drag-reorder via @dnd-kit. We mock the library
 * to capture its `onDragEnd` callback, then drive that callback directly
 * to verify the integration calls ui.reorderInitiative with the right
 * indices.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h } from 'preact';
import { render } from '@testing-library/preact';

const dndInstances = vi.hoisted(() => []);

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    DndContext: (props) => {
      dndInstances.push(props);
      return h('div', null, props.children);
    },
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

import { InitiativeBar } from '../ui/InitiativeBar.jsx';

function makeUi({ isGM = true, order = [] } = {}) {
  return {
    state: {
      initiative: { active: order.length > 0, round: 1, current_index: 0, order },
      tokens: new Map(order.map((e) => [e.token_id, { id: e.token_id, color: '#888' }])),
      characters: new Map(),
      npcs: new Map(),
      settings: { systemConfig: {} },
      fog: { mode: null, revealed: [] },
      isGM: () => isGM,
      isTokenVisibleToPlayer: () => true,
      widgetManager: { userId: '@me:hs' },
    },
    reorderInitiative: vi.fn(),
    _isMyCombatTurn: () => false,
    rollInitiative: vi.fn(),
    endCombat: vi.fn(),
  };
}

beforeEach(() => { dndInstances.length = 0; });

describe('InitiativeBar @dnd-kit wiring', () => {
  it('creates a DndContext on mount when combat is active', () => {
    const ui = makeUi({ order: [
      { token_id: 't1', name: 'Goblin', hp_current: 10, hp_max: 10 },
      { token_id: 't2', name: 'Orc', hp_current: 12, hp_max: 12 },
    ]});
    render(h(InitiativeBar, { ui }));
    expect(dndInstances.length).toBe(1);
    expect(dndInstances[0].onDragEnd).toBeTypeOf('function');
  });

  it('onDragEnd fires reorderInitiative with the new indices', () => {
    const ui = makeUi({ order: [
      { token_id: 't1', name: 'A', hp_current: 1, hp_max: 1 },
      { token_id: 't2', name: 'B', hp_current: 1, hp_max: 1 },
      { token_id: 't3', name: 'C', hp_current: 1, hp_max: 1 },
    ]});
    render(h(InitiativeBar, { ui }));
    
    // Simulate dragging t1 (index 0) to over t3 (index 2)
    dndInstances[0].onDragEnd({
      active: { id: 't1' },
      over: { id: 't3' }
    });
    
    expect(ui.reorderInitiative).toHaveBeenCalledWith(0, 2);
  });

  it('no-ops when active.id === over.id', () => {
    const ui = makeUi({ order: [
      { token_id: 't1', name: 'A', hp_current: 1, hp_max: 1 },
    ]});
    render(h(InitiativeBar, { ui }));
    
    dndInstances[0].onDragEnd({
      active: { id: 't1' },
      over: { id: 't1' }
    });
    
    expect(ui.reorderInitiative).not.toHaveBeenCalled();
  });
  
  it('no-ops when over is null', () => {
    const ui = makeUi({ order: [
      { token_id: 't1', name: 'A', hp_current: 1, hp_max: 1 },
    ]});
    render(h(InitiativeBar, { ui }));
    
    dndInstances[0].onDragEnd({
      active: { id: 't1' },
      over: null
    });
    
    expect(ui.reorderInitiative).not.toHaveBeenCalled();
  });
});
