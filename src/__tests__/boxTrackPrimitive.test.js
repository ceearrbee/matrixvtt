/**
 * `box_track` section primitive - generalizes `stress_boxes` to
 * support multiple named tracks. Back-compat: when config has no
 * `tracks`, falls back to single-track behaviour driven by
 * systemConfig.harm_model.boxes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { _kindsForTest } from '../ui/characterSheetSections.js';

function makeUi({ patchEntity = vi.fn(), harmModel } = {}) {
  return {
    patchEntity,
    state: {
      canEditEntity: () => true,
      isGM: () => true,
      settings: { systemConfig: harmModel ? { harm_model: harmModel } : {} },
    },
    widgetManager: { userId: '@me:hs' },
  };
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('box_track - multi-track config', () => {
  const config = {
    kind: 'box_track', field: 'stress', label: 'Stress',
    tracks: [
      { name: 'Physical', capacities: [1, 2, 3] },
      { name: 'Mental',   capacities: [1, 2, 3] },
    ],
  };

  it('renders each track with its name and the configured number of boxes', () => {
    const ui = makeUi();
    const character = { id: 'c1' };
    render(_kindsForTest.box_track({ ui, character, config }));
    expect(screen.getByText('Physical')).toBeTruthy();
    expect(screen.getByText('Mental')).toBeTruthy();
    // 3 boxes per track × 2 tracks = 6 checkboxes
    expect(screen.getAllByRole('checkbox')).toHaveLength(6);
  });

  it('reflects existing track values', () => {
    const ui = makeUi();
    const character = { id: 'c1', stress: { Physical: [true, false, false], Mental: [false, true, false] } };
    render(_kindsForTest.box_track({ ui, character, config }));
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes[0].checked).toBe(true);   // Physical[0]
    expect(boxes[1].checked).toBe(false);  // Physical[1]
    expect(boxes[3].checked).toBe(false);  // Mental[0]
    expect(boxes[4].checked).toBe(true);   // Mental[1]
  });

  it('toggling a box in track B updates only that track', () => {
    const patchEntity = vi.fn();
    const ui = makeUi({ patchEntity });
    const character = { id: 'c1', stress: { Physical: [true, false, false], Mental: [false, false, false] } };
    render(_kindsForTest.box_track({ ui, character, config }));
    const boxes = screen.getAllByRole('checkbox');
    fireEvent.click(boxes[5]); // Mental[2]
    expect(patchEntity).toHaveBeenCalledWith('c1', {
      stress: {
        Physical: [true, false, false],
        Mental:   [false, false, true],
      },
    });
  });
});

describe('box_track - back-compat with legacy harm_model.boxes', () => {
  const config = { kind: 'box_track', field: 'stress', label: 'Stress' };

  it('falls back to systemConfig.harm_model.boxes when tracks is absent', () => {
    const ui = makeUi({ harmModel: { boxes: [1, 2, 3] } });
    const character = { id: 'c1' };
    render(_kindsForTest.box_track({ ui, character, config }));
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('reads a legacy array-shaped stress value', () => {
    const ui = makeUi({ harmModel: { boxes: [1, 2, 3] } });
    const character = { id: 'c1', stress: [true, false, true] };
    render(_kindsForTest.box_track({ ui, character, config }));
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes[0].checked).toBe(true);
    expect(boxes[1].checked).toBe(false);
    expect(boxes[2].checked).toBe(true);
  });

  it('toggles a legacy stress array via the existing setStressBox seam', () => {
    const patchEntity = vi.fn();
    const ui = makeUi({ patchEntity, harmModel: { boxes: [1, 2, 3] } });
    const character = { id: 'c1', stress: [false, false, false] };
    render(_kindsForTest.box_track({ ui, character, config }));
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    expect(patchEntity).toHaveBeenCalledWith('c1', {
      stress: [false, true, false],
    });
  });

  it('renders nothing useful when neither tracks nor harm_model is configured', () => {
    const ui = makeUi();
    const character = { id: 'c1' };
    render(_kindsForTest.box_track({ ui, character, config }));
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
});
