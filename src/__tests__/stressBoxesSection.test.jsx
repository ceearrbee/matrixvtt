/**
 * The legacy stress_boxes section (harm_model.boxes) must write through
 * ui.patchEntity like every other inline sheet edit, never through
 * ui.setStressBox: no wiring module ever assigns that, so clicking a
 * stress box would be a silent no-op.
 */
import { describe, it, expect, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent } from '@testing-library/preact';
import { StressBoxes } from '../ui/character-sheet-sections/display.js';

function mount(character, patchEntity) {
  const ui = /** @type {any} */ ({
    state: { settings: { systemConfig: { harm_model: { boxes: [1, 2, 3] } } } },
    patchEntity,
  });
  return render(h(StressBoxes, { ui, character }));
}

describe('stress_boxes section', () => {
  it('checking a box patches the toggled stress array', () => {
    const patchEntity = vi.fn();
    const { container } = mount({ id: 'c1', stress: [false, false, false] }, patchEntity);
    const boxes = container.querySelectorAll('input[type="checkbox"]');
    expect(boxes).toHaveLength(3);
    fireEvent.click(boxes[1]);
    expect(patchEntity).toHaveBeenCalledWith('c1', { stress: [false, true, false] });
  });

  it('unchecking a box clears only that index', () => {
    const patchEntity = vi.fn();
    const { container } = mount({ id: 'c1', stress: [true, true, false] }, patchEntity);
    fireEvent.click(container.querySelectorAll('input[type="checkbox"]')[0]);
    expect(patchEntity).toHaveBeenCalledWith('c1', { stress: [false, true, false] });
  });
});
