/**
 * MapForm GM controls - environment tint.
 *
 * Verifies the per-map env_tint and grid_type pickers round-trip
 * through submitMapForm into ui.state.updateMap.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitMapForm } from '../ui/MapsPanel.jsx';

function makeModal({ envTint = '', gridType = 'square' } = {}) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div class="modal-content">
      <input id="map-name" value="Keep" />
      <select id="map-source-type"><option value="none">None</option></select>
      <input id="map-url" value="" />
      <input id="map-width" value="10" />
      <input id="map-height" value="12" />
      <input id="map-cell-px" value="40" />
      <select id="map-grid-type">
        <option value="square">Square</option>
        <option value="hex_pointy">Hex pointy</option>
        <option value="hex_flat">Hex flat</option>
      </select>
      <select id="map-env-tint">
        <option value="">None</option>
        <option value="dusk">Dusk</option>
        <option value="cave">Cave</option>
      </select>
    </div>
  `;
  const modal = wrapper.querySelector('.modal-content');
  modal.querySelector('#map-grid-type').value = gridType;
  modal.querySelector('#map-env-tint').value = envTint;
  modal.querySelector('#map-source-type').value = 'none';
  return modal;
}

describe('submitMapForm - env_tint + grid_type', () => {
  let ui;
  beforeEach(() => {
    ui = {
      _toast: vi.fn(),
      state: {
        updateMap: vi.fn().mockResolvedValue(undefined),
        createMap: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  it('persists env_tint and grid_type when editing an existing map', async () => {
    const modal = makeModal({ envTint: 'cave', gridType: 'hex_pointy' });
    const ok = await submitMapForm(ui, modal, 'map-keep');
    expect(ok).toBe(true);
    expect(ui.state.updateMap).toHaveBeenCalledWith('map-keep', expect.objectContaining({
      env_tint: 'cave',
      grid_type: 'hex_pointy',
    }));
  });

  it('saves env_tint as null when the picker is set to "None"', async () => {
    const modal = makeModal({ envTint: '', gridType: 'square' });
    await submitMapForm(ui, modal, 'map-x');
    expect(ui.state.updateMap).toHaveBeenCalledWith('map-x', expect.objectContaining({
      env_tint: null,
      grid_type: 'square',
    }));
  });

  it('passes env_tint and grid_type through to createMap on a new map', async () => {
    const modal = makeModal({ envTint: 'dusk', gridType: 'hex_flat' });
    await submitMapForm(ui, modal, '__new__');
    expect(ui.state.createMap).toHaveBeenCalledWith(expect.objectContaining({
      env_tint: 'dusk',
      grid_type: 'hex_flat',
    }));
  });
});
