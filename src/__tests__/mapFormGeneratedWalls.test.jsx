/**
 * The walls action in the map form: explicit, GM-only, and only where
 * it means anything.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { h } from 'preact';
import { MapFormPanel } from '../ui/MapForm.jsx';

const GENERATED = {
  name: 'Crypt', width_cells: 24, height_cells: 18, cell_px: 50,
  background: { kind: 'generated', generator: 'dungeon', seed: 'wall01' },
};

function makeUi(overrides = {}) {
  return {
    _toast: vi.fn(),
    state: {
      isGM: () => true,
      applyGeneratedWalls: vi.fn().mockResolvedValue(114),
      ...overrides,
    },
  };
}

function renderForm(ui, { selectedMap, selectedId = 'map-1', isNewMode = false } = {}) {
  return render(h(MapFormPanel, {
    ui, selectedMap, isNewMode, selectedId, onSaved: () => {}, submit: () => {},
  }));
}

const wallsButton = (c) => c.querySelector('[data-generate-walls]');

describe('generated walls action', () => {
  it('is offered for a saved map with a generated layout', () => {
    expect(wallsButton(renderForm(makeUi(), { selectedMap: GENERATED }).container)).toBeTruthy();
  });

  it('is absent for a map whose background is a plain tile', () => {
    const tile = { ...GENERATED, background: { kind: 'tile', tile: 'cobble' } };
    expect(wallsButton(renderForm(makeUi(), { selectedMap: tile }).container)).toBeNull();
  });

  it('is absent for a map with no background at all', () => {
    const plain = { ...GENERATED, background: null };
    expect(wallsButton(renderForm(makeUi(), { selectedMap: plain }).container)).toBeNull();
  });

  // Walls need a map_id, which an unsaved map does not have yet.
  it('is absent while creating a map that has not been saved', () => {
    expect(wallsButton(renderForm(makeUi(), { selectedMap: null, isNewMode: true, selectedId: '__new__' }).container)).toBeNull();
  });

  it('applies the walls and reports how many', async () => {
    const ui = makeUi();
    const { container } = renderForm(ui, { selectedMap: GENERATED });
    fireEvent.click(wallsButton(container));
    await new Promise((r) => setTimeout(r, 0));
    expect(ui.state.applyGeneratedWalls).toHaveBeenCalledWith('map-1');
    expect(ui._toast).toHaveBeenCalledWith(expect.stringContaining('114'), 'success');
  });

  it('surfaces a failure instead of failing silently', async () => {
    const ui = makeUi({ applyGeneratedWalls: vi.fn().mockRejectedValue(new Error('nope')) });
    const { container } = renderForm(ui, { selectedMap: GENERATED });
    fireEvent.click(wallsButton(container));
    await new Promise((r) => setTimeout(r, 0));
    expect(ui._toast).toHaveBeenCalledWith(expect.stringContaining('nope'), 'error');
  });

  it('says plainly that it replaces what it made last time', () => {
    const { container } = renderForm(makeUi(), { selectedMap: GENERATED });
    expect(wallsButton(container).getAttribute('title')).toMatch(/replace/i);
  });
});
