/**
 * Token variants - labelled alternate portraits for the same token
 * (bloodied, dead, transformed, …). PlanarAlly's variant concept,
 * pared to the data the renderer already understands.
 *
 * Storage shape:
 *   token.variants = [{ label: string, image_url: string }]
 *
 * Edit: TokenFormModal grows a variant list editor with a "Use" button
 * that swaps the current portrait to that variant's image. Save
 * persists both `image_url` (the live portrait) and `variants` (the
 * named pool).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { showTokenFormModal } from '../ui/TokenFormModal.jsx';
import { validateToken } from '../utils/schemas/actors.js';

function makeUi() {
  return {
    state: { tokens: new Map() },
    updateToken: vi.fn().mockResolvedValue(true),
    createToken: vi.fn().mockResolvedValue(true),
    widgetManager: { uploadMedia: vi.fn() },
    _toast: vi.fn(),
  };
}

beforeEach(() => { document.body.innerHTML = ''; });

function setup(token = { id: 't1', name: 'T', col: 0, row: 0 }, ui = makeUi()) {
  ui.state.tokens.set(token.id, token);
  showTokenFormModal(ui, token.id);
  return ui;
}

describe('token variants - schema', () => {
  const base = { id: 't1', map_id: 'm', sheet_id: null, col: 0, row: 0 };

  it('accepts a well-formed variants array', () => {
    expect(validateToken({
      ...base,
      variants: [
        { label: 'Healthy',  image_url: 'mxc://x/healthy' },
        { label: 'Bloodied', image_url: 'mxc://x/bloodied' },
      ],
    })).toBe(true);
  });

  it('accepts an empty variants array', () => {
    expect(validateToken({ ...base, variants: [] })).toBe(true);
  });

  it('rejects a non-array variants field', () => {
    expect(() => validateToken({ ...base, variants: 'no' })).toThrow(/variants/);
  });

  it('rejects a variant missing label', () => {
    expect(() => validateToken({ ...base, variants: [{ image_url: 'mxc://x' }] })).toThrow(/label/);
  });

  it('rejects a variant missing image_url', () => {
    expect(() => validateToken({ ...base, variants: [{ label: 'X' }] })).toThrow(/image_url/);
  });
});

describe('token variants - form editor', () => {
  it('shows "No variants." + Add button when the token has none', () => {
    setup();
    expect(screen.getByText('No variants.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /add variant/i })).toBeTruthy();
  });

  it('seeds one row per existing variant', () => {
    setup({
      id: 't1', name: 'T', col: 0, row: 0,
      variants: [
        { label: 'Healthy',  image_url: 'mxc://x/healthy' },
        { label: 'Bloodied', image_url: 'mxc://x/bloodied' },
      ],
    });
    expect(screen.getByLabelText(/variant 1 label/i).value).toBe('Healthy');
    expect(screen.getByLabelText(/variant 1 image url/i).value).toBe('mxc://x/healthy');
    expect(screen.getByLabelText(/variant 2 label/i).value).toBe('Bloodied');
  });

  it('Add appends; Remove drops the targeted row', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /add variant/i }));
    fireEvent.click(screen.getByRole('button', { name: /add variant/i }));
    expect(screen.getByLabelText(/variant 1 label/i)).toBeTruthy();
    expect(screen.getByLabelText(/variant 2 label/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /remove variant 1/i }));
    expect(screen.queryByLabelText(/variant 2 label/i)).toBeNull();
  });

  it('Submit writes variants[] (label+image_url, blank-label rows dropped)', async () => {
    const ui = setup();
    fireEvent.click(screen.getByRole('button', { name: /add variant/i }));
    fireEvent.input(screen.getByLabelText(/variant 1 label/i), { target: { value: 'Bloodied' } });
    fireEvent.input(screen.getByLabelText(/variant 1 image url/i), { target: { value: 'mxc://x/blood' } });
    fireEvent.click(screen.getByRole('button', { name: /add variant/i }));
    // Second row blank - should drop at submit
    fireEvent.submit(document.getElementById('token-form'));
    await Promise.resolve(); await Promise.resolve();
    const [, patch] = ui.updateToken.mock.calls[0];
    expect(patch.variants).toEqual([{ label: 'Bloodied', image_url: 'mxc://x/blood' }]);
  });

  it('clicking "Use" on a variant swaps the portrait preview to that URL', async () => {
    const ui = setup({
      id: 't1', name: 'T', col: 0, row: 0,
      image_url: 'mxc://x/healthy',
      variants: [
        { label: 'Healthy',  image_url: 'mxc://x/healthy' },
        { label: 'Bloodied', image_url: 'mxc://x/blood' },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: /use variant 2/i }));
    fireEvent.submit(document.getElementById('token-form'));
    await Promise.resolve(); await Promise.resolve();
    const [, patch] = ui.updateToken.mock.calls[0];
    expect(patch.image_url).toBe('mxc://x/blood');
    // Variants pool unchanged
    expect(patch.variants).toHaveLength(2);
  });

  it('"Use" is disabled when the variant has no image URL set', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /add variant/i }));
    const useBtn = screen.getByRole('button', { name: /use variant 1/i });
    expect(useBtn.disabled).toBe(true);
  });
});
