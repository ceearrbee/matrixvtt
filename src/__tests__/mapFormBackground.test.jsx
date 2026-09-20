/**
 * Map background wiring: the browse affordance the URL field has always
 * promised, and the descriptor round-tripping through submitMapForm.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/preact';
import { h } from 'preact';
import { submitMapForm } from '../ui/MapsPanel.jsx';
import { MapFormPanel } from '../ui/MapForm.jsx';

function makeModal({ sourceType = 'none', background = '', url = '' } = {}) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div class="modal-content">
      <input id="map-name" value="Keep" />
      <select id="map-source-type">
        <option value="none">None</option>
        <option value="url">URL</option>
        <option value="background">Background</option>
      </select>
      <input id="map-url" value="" />
      <input id="map-background" type="hidden" value="" />
      <input id="map-width" value="10" />
      <input id="map-height" value="12" />
      <input id="map-cell-px" value="40" />
      <select id="map-grid-type"><option value="square">Square</option></select>
      <select id="map-env-tint"><option value="">None</option></select>
    </div>
  `;
  const modal = wrapper.querySelector('.modal-content');
  modal.querySelector('#map-source-type').value = sourceType;
  modal.querySelector('#map-background').value = background;
  modal.querySelector('#map-url').value = url;
  return modal;
}

function makeUi() {
  return {
    _toast: vi.fn(),
    state: {
      isGM: () => true,
      updateMap: vi.fn().mockResolvedValue(undefined),
      createMap: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe('submitMapForm - background descriptor', () => {
  let ui;
  beforeEach(() => { ui = makeUi(); });

  it('writes the chosen tile background and leaves image_url null', async () => {
    const modal = makeModal({
      sourceType: 'background',
      background: JSON.stringify({ kind: 'tile', tile: 'cobble', scale: 1 }),
    });
    expect(await submitMapForm(ui, modal, 'm1')).toBe(true);
    expect(ui.state.updateMap).toHaveBeenCalledWith('m1', expect.objectContaining({
      background: { kind: 'tile', tile: 'cobble', scale: 1 },
      image_url: null,
    }));
  });

  it('writes a null background for every other source', async () => {
    const modal = makeModal({ sourceType: 'url', url: 'https://x/a.png' });
    await submitMapForm(ui, modal, 'm1');
    expect(ui.state.updateMap).toHaveBeenCalledWith('m1', expect.objectContaining({
      background: null,
      image_url: 'https://x/a.png',
    }));
  });

  it('writes a generated descriptor with its palette, style and params', async () => {
    const descriptor = {
      kind: 'generated', generator: 'cave', seed: 'zz9',
      palette: 'frozen', style: 'lines', params: { fill: 40, smoothing: 3, water: 0 },
    };
    const modal = makeModal({ sourceType: 'background', background: JSON.stringify(descriptor) });
    expect(await submitMapForm(ui, modal, 'm1')).toBe(true);
    expect(ui.state.updateMap).toHaveBeenCalledWith('m1', expect.objectContaining({
      background: descriptor,
      image_url: null,
    }));
  });

  it('rejects a generated descriptor with an unusable seed', async () => {
    const modal = makeModal({
      sourceType: 'background',
      background: JSON.stringify({ kind: 'generated', generator: 'cave', seed: 'not a seed!' }),
    });
    await submitMapForm(ui, modal, 'm1');
    expect(ui.state.updateMap).toHaveBeenCalledWith('m1', expect.objectContaining({ background: null }));
  });

  // A stale or hand-edited hidden field must not take the save down with it.
  it('treats an unparseable descriptor as no background rather than throwing', async () => {
    const modal = makeModal({ sourceType: 'background', background: '{not json' });
    expect(await submitMapForm(ui, modal, 'm1')).toBe(true);
    expect(ui.state.updateMap).toHaveBeenCalledWith('m1', expect.objectContaining({ background: null }));
  });

  it('rejects a descriptor the renderer could not paint', async () => {
    const modal = makeModal({ sourceType: 'background', background: JSON.stringify({ kind: 'tile' }) });
    await submitMapForm(ui, modal, 'm1');
    expect(ui.state.updateMap).toHaveBeenCalledWith('m1', expect.objectContaining({ background: null }));
  });
});

describe('MapForm background controls', () => {
  it('offers a browse button in the URL group, which the placeholder has always promised', () => {
    const ui = makeUi();
    const { container } = render(h(MapFormPanel, {
      ui, selectedMap: { name: 'M', width_cells: 10, height_cells: 10, cell_px: 40, image_url: 'https://x/a.png' },
      isNewMode: false, selectedId: 'm1', onSaved: () => {}, submit: () => {},
    }));
    const group = container.querySelector('#map-url-group');
    const browse = group.querySelector('button');
    expect(browse).toBeTruthy();
    expect(browse.getAttribute('aria-label')).toMatch(/librar|browse/i);
  });

  it('offers a background source option and a hidden field to carry the descriptor', () => {
    const ui = makeUi();
    const { container } = render(h(MapFormPanel, {
      ui, selectedMap: null, isNewMode: true, selectedId: '__new__', onSaved: () => {}, submit: () => {},
    }));
    const options = [...container.querySelectorAll('#map-source-type option')].map((o) => o.value);
    expect(options).toContain('background');
    expect(container.querySelector('#map-background')).toBeTruthy();
  });

  // An uploaded image is a layer image, not a painted fill, so choosing
  // one has to land in the URL field rather than the descriptor.
  it('routes a chosen upload into the image URL, not the background descriptor', async () => {
    const ui = makeUi();
    const { container } = render(h(MapFormPanel, {
      ui, selectedMap: null, isNewMode: true, selectedId: '__new__', onSaved: () => {}, submit: () => {},
    }));
    const { _chooseForTest } = await import('../ui/map-form/SourceField.jsx');
    expect(_chooseForTest({ kind: 'image', image_url: 'mxc://hs/tavern' }))
      .toEqual({ sourceType: 'url', imageUrl: 'mxc://hs/tavern', background: null });
    expect(_chooseForTest({ kind: 'tile', tile: 'cobble', scale: 1 }))
      .toEqual({ sourceType: 'background', imageUrl: null, background: { kind: 'tile', tile: 'cobble', scale: 1 } });
    expect(_chooseForTest(null))
      .toEqual({ sourceType: 'none', imageUrl: null, background: null });
    expect(container.querySelector('#map-url')).toBeTruthy();
  });

  it('summarises an existing tile background instead of showing raw JSON', () => {
    const ui = makeUi();
    const { container } = render(h(MapFormPanel, {
      ui,
      selectedMap: {
        name: 'M', width_cells: 10, height_cells: 10, cell_px: 40,
        background: { kind: 'tile', tile: 'stone-floor', scale: 1 },
      },
      isNewMode: false, selectedId: 'm1', onSaved: () => {}, submit: () => {},
    }));
    const group = container.querySelector('#map-background-group');
    expect(group.textContent).toContain('stone-floor');
    expect(group.textContent).not.toContain('{');
    expect(container.querySelector('#map-source-type').value).toBe('background');
  });
});
