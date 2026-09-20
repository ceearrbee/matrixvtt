/**
 * Uploaded tab: images already uploaded into this room, so a battlemap
 * is uploaded once and reusable across every map afterwards.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent } from '@testing-library/preact';
import { showBackgroundPicker } from '../ui/background-picker/BackgroundPickerModal.jsx';
import { closeAllOpenModals } from '../ui/modal-host.js';
import { _resetBackgroundManifestCache } from '../utils/builtin-backgrounds.js';
import { assetsSignal } from '../state/signals.js';
import { homeserverSignal } from '../state/ui-signals.js';
import { ASSET_KINDS } from '../utils/constants.js';

function flush() { return new Promise((r) => setTimeout(r, 20)); }

function seedAssets(entries) {
  assetsSignal.value = new Map(entries.map((a) => [a.id, a]));
}

const TAVERN = { id: 'ast-1', mxc: 'mxc://hs/tavern', name: 'tavern.png', kind: ASSET_KINDS.MAP, ts: 100 };
const CRYPT = { id: 'ast-2', mxc: 'mxc://hs/crypt', name: 'crypt.png', kind: ASSET_KINDS.MAP, ts: 300 };
const ORC = { id: 'ast-3', mxc: 'mxc://hs/orc', name: 'orc.png', kind: ASSET_KINDS.PORTRAIT, ts: 200 };

async function openUploaded() {
  showBackgroundPicker({});
  await flush();
  fireEvent.click(document.querySelector('[data-tab="uploaded"]'));
  await flush();
}

describe('showBackgroundPicker - uploaded tab', () => {
  beforeEach(() => {
    _resetBackgroundManifestCache();
    homeserverSignal.value = 'https://hs.example';
    assetsSignal.value = new Map();
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true, json: () => Promise.resolve({ version: 1, materials: [], tiles: [] }),
    }));
  });
  afterEach(() => {
    closeAllOpenModals();
    assetsSignal.value = new Map();
    homeserverSignal.value = null;
    delete global.fetch;
  });

  it('lists the room uploads newest first', async () => {
    seedAssets([TAVERN, CRYPT, ORC]);
    await openUploaded();
    const ids = [...document.querySelectorAll('[data-asset-id]')].map((n) => n.dataset.assetId);
    expect(ids).toEqual(['ast-2', 'ast-3', 'ast-1']);
  });

  it('resolves each mxc thumbnail so it actually renders', async () => {
    seedAssets([TAVERN]);
    await openUploaded();
    expect(document.querySelector('[data-asset-id] img').getAttribute('src'))
      .toBe('https://hs.example/_matrix/media/v3/download/hs/tavern');
  });

  it('returns an image descriptor carrying the mxc, not a copy of the bytes', async () => {
    const onSelect = vi.fn();
    seedAssets([TAVERN]);
    showBackgroundPicker({ onSelect });
    await flush();
    fireEvent.click(document.querySelector('[data-tab="uploaded"]'));
    await flush();
    fireEvent.click(document.querySelector('[data-asset-id="ast-1"]'));
    await flush();
    expect(onSelect).toHaveBeenCalledWith({ kind: 'image', image_url: 'mxc://hs/tavern' });
  });

  it('explains itself when the room has no uploads yet', async () => {
    await openUploaded();
    expect(document.querySelector('[data-asset-id]')).toBeNull();
    expect(document.querySelector('.bg-picker__empty').textContent).toMatch(/upload/i);
  });

  it('names each upload so a grid of dark battlemaps is still navigable', async () => {
    seedAssets([TAVERN]);
    await openUploaded();
    const tile = document.querySelector('[data-asset-id="ast-1"]');
    expect(tile.textContent).toContain('tavern.png');
    expect(tile.getAttribute('aria-label')).toContain('tavern.png');
  });
});
