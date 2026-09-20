/**
 * Background picker. Stubs fetch with a small tile manifest and
 * exercises the material filter, selection, the no-background escape
 * hatch, and the credit line.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent } from '@testing-library/preact';
import { _resetBackgroundManifestCache } from '../utils/builtin-backgrounds.js';
import { showBackgroundPicker } from '../ui/background-picker/BackgroundPickerModal.jsx';
import { closeAllOpenModals } from '../ui/modal-host.js';

const MANIFEST = {
  version: 1,
  materials: ['earth', 'stone'],
  tiles: [
    { id: 'stone-floor', file: 'stone-floor.webp', label: 'Stone floor', material: 'stone', title: 'Rock058 colour map', author: 'ambientCG', source_url: 'https://ambientcg.com/view?id=Rock058', license: 'CC0-1.0' },
    { id: 'cobble', file: 'cobble.webp', label: 'Cobblestone', material: 'stone', title: 'PavingStones046 colour map', author: 'ambientCG', source_url: 'https://x', license: 'CC0-1.0' },
    { id: 'grass', file: 'grass.webp', label: 'Grass', material: 'earth', title: 'Grass005 colour map', author: 'ambientCG', source_url: 'https://y', license: 'CC0-1.0' },
  ],
};

function flush() { return new Promise((r) => setTimeout(r, 20)); }
function tiles() { return [...document.querySelectorAll('[data-tile-id]')]; }
function byText(text) {
  return [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
}
async function openGenerate() {
  fireEvent.click(document.querySelector('[data-tab="generate"]'));
  await flush();
}

describe('showBackgroundPicker', () => {
  beforeEach(() => {
    _resetBackgroundManifestCache();
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(MANIFEST) }));
  });
  afterEach(() => { closeAllOpenModals(); delete global.fetch; });

  it('lists every tile from the manifest', async () => {
    showBackgroundPicker({});
    await flush();
    expect(tiles().map((t) => t.dataset.tileId)).toEqual(['stone-floor', 'cobble', 'grass']);
  });

  it('returns a tile descriptor and closes on selection', async () => {
    const onSelect = vi.fn();
    showBackgroundPicker({ onSelect });
    await flush();
    fireEvent.click(tiles().find((t) => t.dataset.tileId === 'cobble'));
    await flush();
    expect(onSelect).toHaveBeenCalledWith({ kind: 'tile', tile: 'cobble', scale: 1 });
    expect(document.querySelector('[data-tile-id]')).toBeNull();
  });

  it('filters by material and can go back to all', async () => {
    showBackgroundPicker({});
    await flush();
    fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'earth'));
    await flush();
    expect(tiles().map((t) => t.dataset.tileId)).toEqual(['grass']);
    fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'All'));
    await flush();
    expect(tiles().length).toBe(3);
  });

  it('offers a no-background choice that clears the fill', async () => {
    const onSelect = vi.fn();
    showBackgroundPicker({ onSelect });
    await flush();
    fireEvent.click(document.querySelector('[data-tile-none]'));
    await flush();
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('credits the hovered tile, and says so politely', async () => {
    showBackgroundPicker({});
    await flush();
    const credit = document.querySelector('.bg-picker__credit');
    expect(credit.getAttribute('aria-live')).toBe('polite');
    fireEvent.mouseOver(tiles()[0]);
    await flush();
    expect(credit.textContent).toContain('Rock058 colour map');
    expect(credit.textContent).toContain('ambientCG');
  });

  it('credits on keyboard focus too, not just hover', async () => {
    showBackgroundPicker({});
    await flush();
    fireEvent.focus(tiles()[2]);
    await flush();
    expect(document.querySelector('.bg-picker__credit').textContent).toContain('Grass005');
  });

  it('shows the licence rather than leaving the claim implicit', async () => {
    showBackgroundPicker({});
    await flush();
    expect(document.querySelector('.bg-picker__attribution').textContent).toMatch(/CC0/);
  });

  it('surfaces a manifest failure instead of an empty grid', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 404 }));
    showBackgroundPicker({});
    await flush();
    expect(document.querySelector('.bg-picker__error')).toBeTruthy();
  });
});


describe('showBackgroundPicker - generate tab', () => {
  beforeEach(() => {
    _resetBackgroundManifestCache();
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(MANIFEST) }));
  });
  afterEach(() => { closeAllOpenModals(); delete global.fetch; });

  it('offers every tab, with textures first', async () => {
    showBackgroundPicker({});
    await flush();
    const tabs = [...document.querySelectorAll('[data-tab]')].map((t) => t.dataset.tab);
    expect(tabs).toEqual(['textures', 'generate', 'uploaded']);
    expect(document.querySelector('[data-tab="textures"]').getAttribute('aria-selected')).toBe('true');
  });

  it('lists every generator and every palette', async () => {
    showBackgroundPicker({});
    await openGenerate();
    const generators = [...document.querySelectorAll('#bg-generator option')].map((o) => o.value);
    expect(generators).toEqual(expect.arrayContaining(['dungeon', 'cave']));
    const palettes = [...document.querySelectorAll('#bg-palette option')].map((o) => o.value);
    expect(palettes).toEqual(expect.arrayContaining(['dungeon', 'crypt', 'forest']));
  });

  it('starts with a seed already filled in, so the preview is never blank', async () => {
    showBackgroundPicker({});
    await openGenerate();
    expect(document.querySelector('#bg-seed').value).toMatch(/^[a-z0-9]{6}$/);
  });

  it('rerolls the seed', async () => {
    showBackgroundPicker({});
    await openGenerate();
    const before = document.querySelector('#bg-seed').value;
    fireEvent.click(byText('Reroll'));
    await flush();
    expect(document.querySelector('#bg-seed').value).not.toBe(before);
  });

  it('returns a generated descriptor carrying the chosen options', async () => {
    const onSelect = vi.fn();
    showBackgroundPicker({ onSelect });
    await openGenerate();
    fireEvent.change(document.querySelector('#bg-generator'), { target: { value: 'cave' } });
    fireEvent.change(document.querySelector('#bg-palette'), { target: { value: 'frozen' } });
    fireEvent.input(document.querySelector('#bg-seed'), { target: { value: 'abc123' } });
    await flush();
    fireEvent.click(byText('Use this map'));
    await flush();
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'generated', generator: 'cave', palette: 'frozen', seed: 'abc123', style: 'textured',
    }));
  });

  it('offers the plain line style as well as the textured one', async () => {
    const onSelect = vi.fn();
    showBackgroundPicker({ onSelect });
    await openGenerate();
    fireEvent.click(byText('Plain'));
    await flush();
    fireEvent.click(byText('Use this map'));
    await flush();
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ style: 'lines' }));
  });

  it('exposes the generator params as labelled numeric controls', async () => {
    showBackgroundPicker({});
    await openGenerate();
    const inputs = [...document.querySelectorAll('[data-param]')];
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) {
      expect(input.getAttribute('aria-label')).toBeTruthy();
      expect(Number(input.min)).toBeLessThan(Number(input.max));
    }
  });

  it('swaps the param set when the generator changes', async () => {
    showBackgroundPicker({});
    await openGenerate();
    const dungeonParams = [...document.querySelectorAll('[data-param]')].map((i) => i.dataset.param);
    fireEvent.change(document.querySelector('#bg-generator'), { target: { value: 'cave' } });
    await flush();
    const caveParams = [...document.querySelectorAll('[data-param]')].map((i) => i.dataset.param);
    expect(caveParams).not.toEqual(dungeonParams);
    expect(caveParams).toContain('fill');
  });

  it('refuses a seed that is not a seed instead of saving an unpaintable map', async () => {
    const onSelect = vi.fn();
    showBackgroundPicker({ onSelect });
    await openGenerate();
    fireEvent.input(document.querySelector('#bg-seed'), { target: { value: 'not a seed!' } });
    await flush();
    fireEvent.click(byText('Use this map'));
    await flush();
    expect(onSelect).not.toHaveBeenCalled();
    expect(document.querySelector('.bg-picker__seed-error')).toBeTruthy();
  });

  it('renders a preview canvas at the map size it was given', async () => {
    showBackgroundPicker({ mapSize: { width_cells: 20, height_cells: 15, cell_px: 40 } });
    await openGenerate();
    const canvas = document.querySelector('.bg-picker__preview canvas');
    expect(canvas).toBeTruthy();
    expect(canvas.width / canvas.height).toBeCloseTo(20 / 15, 1);
  });
});
