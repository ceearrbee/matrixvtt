/**
 * Locks in the public shape of the `attachMapControls(ui)` module so
 * a refactor can't regress the contract or fold it back into
 * src/ui/ui-methods.js.
 */
import { describe, it, expect, vi } from 'vitest';
import { attachMapControls } from '../ui/map-controls-wiring.js';

function makeUI() {
  const mapRenderer = {
    zoomIn: vi.fn(), zoomOut: vi.fn(),
    setTool: vi.fn(),
    drawColor: '#000', drawWidth: 2,
    _pingMode: false,
    render: vi.fn(),
  };
  return {
    mapRenderer,
    state: { clearDrawings: vi.fn() },
  };
}

describe('attachMapControls(ui)', () => {
  it('exposes zoomIn / zoomOut that call through to mapRenderer', () => {
    const ui = makeUI();
    attachMapControls(ui);
    ui.zoomIn(); ui.zoomOut();
    expect(ui.mapRenderer.zoomIn).toHaveBeenCalledOnce();
    expect(ui.mapRenderer.zoomOut).toHaveBeenCalledOnce();
  });

  it('setDrawTool delegates to mapRenderer.setTool', () => {
    const ui = makeUI();
    attachMapControls(ui);
    ui.setDrawTool('pencil');
    expect(ui.mapRenderer.setTool).toHaveBeenCalledWith('pencil');
  });

  it('setDrawColor writes mapRenderer.drawColor', () => {
    const ui = makeUI();
    attachMapControls(ui);
    ui.setDrawColor('#abc');
    expect(ui.mapRenderer.drawColor).toBe('#abc');
  });

  it('setDrawWidth coerces string → number and defaults non-numeric to 3', () => {
    const ui = makeUI();
    attachMapControls(ui);
    ui.setDrawWidth('5');
    expect(ui.mapRenderer.drawWidth).toBe(5);
    ui.setDrawWidth('abc');
    expect(ui.mapRenderer.drawWidth).toBe(3);
  });

  it('pingLocation flips mapRenderer._pingMode to true', () => {
    const ui = makeUI();
    attachMapControls(ui);
    ui.pingLocation();
    expect(ui.mapRenderer._pingMode).toBe(true);
  });

  it('clearDrawings calls state.clearDrawings', () => {
    const ui = makeUI();
    attachMapControls(ui);
    ui.clearDrawings();
    expect(ui.state.clearDrawings).toHaveBeenCalledOnce();
  });

  it('updateMapPanel calls mapRenderer.render', () => {
    const ui = makeUI();
    attachMapControls(ui);
    ui.updateMapPanel();
    expect(ui.mapRenderer.render).toHaveBeenCalledOnce();
  });

  it('tolerates a missing mapRenderer - updates become no-ops', () => {
    const ui = { mapRenderer: null, state: { clearDrawings: vi.fn() } };
    attachMapControls(ui);
    expect(() => ui.zoomIn()).not.toThrow();
    expect(() => ui.setDrawTool('pencil')).not.toThrow();
    expect(() => ui.updateMapPanel()).not.toThrow();
  });
});
