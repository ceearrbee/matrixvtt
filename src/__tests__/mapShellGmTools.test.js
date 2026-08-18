/**
 * GM-only toolbar buttons must
 * carry `data-tool-kind="gm"` so CSS can tint their active state
 * distinctly from base tools.
 *
 * Tools are now grouped - switch to GM group before asserting.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { h } from 'preact';
import { render, fireEvent } from '@testing-library/preact';
import { MapStrip } from '../ui/MapStrip.jsx';
import { tablePhaseSignal, gmPrepActiveSignal, activeToolGroupSignal } from '../state/ui-signals.js';
import { UI_MODES, TOOL_GROUPS } from '../utils/constants.js';

function fakeUI({ isGM }) {
  return {
    state: { isGM: () => isGM },
    setDrawTool: () => {},
    setDrawColor: () => {},
    setDrawWidth: () => {},
    pingLocation: () => {},
    undoDrawing: () => {},
    shouldShowMapHelp: () => false,
  };
}

describe('MapStrip - GM tool kind marker', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    tablePhaseSignal.value = UI_MODES.NARRATIVE; gmPrepActiveSignal.value = true;
    activeToolGroupSignal.value = TOOL_GROUPS.GM;
  });

  it('marks GM-only tools with data-tool-kind="gm"', () => {
    const { container } = render(h(MapStrip, { ui: fakeUI({ isGM: true }) }));
    const wallBtn = container.querySelector('[data-tool="wall"]');
    expect(wallBtn).not.toBeNull();
    expect(wallBtn.getAttribute('data-tool-kind')).toBe('gm');
  });

  it('does not mark base tools as GM (switch to Drawing group to confirm)', () => {
    activeToolGroupSignal.value = TOOL_GROUPS.DRAWING;
    const { container } = render(h(MapStrip, { ui: fakeUI({ isGM: true }) }));
    const pencil = container.querySelector('[data-tool="pencil"]');
    expect(pencil.getAttribute('data-tool-kind')).not.toBe('gm');
  });
});
