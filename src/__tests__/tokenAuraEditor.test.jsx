/**
 * TokenFormModal - aura list editor. Replaces the legacy
 * single aura_radius/aura_color row with a dynamic list of
 * {radius, color} entries. Locks in:
 *   - empty seed → "No auras." + Add button only
 *   - legacy seed → one prefilled row
 *   - new-shape seed → one row per auras[] entry
 *   - Add appends a row; Remove drops the targeted row
 *   - Submit writes auras[] and zeroes legacy fields
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/preact';
import { showTokenFormModal } from '../ui/TokenFormModal.jsx';

function makeUi({ updateToken = vi.fn().mockResolvedValue(true), createToken = vi.fn().mockResolvedValue(true) } = {}) {
  return {
    state: { tokens: new Map() },
    updateToken,
    createToken,
    widgetManager: { uploadMedia: vi.fn() },
    _toast: vi.fn(),
  };
}

beforeEach(() => { document.body.innerHTML = ''; });

function setupForToken(token, ui = makeUi()) {
  ui.state.tokens.set(token.id, token);
  showTokenFormModal(ui, token.id);
  return ui;
}

describe('aura list editor', () => {
  it('renders "No auras." and an Add button when the token has none', () => {
    setupForToken({ id: 't1', name: 'T', col: 0, row: 0 });
    expect(screen.getByText('No auras.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /add aura/i })).toBeTruthy();
  });

  it('seeds a single row from legacy aura_radius/aura_color', () => {
    setupForToken({
      id: 't1', name: 'T', col: 0, row: 0,
      aura_radius: 3, aura_color: '#ff8800',
    });
    const radius = screen.getByLabelText(/aura 1 radius/i);
    const color = screen.getByLabelText(/aura 1 colour/i);
    expect(radius.value).toBe('3');
    expect(color.value).toBe('#ff8800');
  });

  it('seeds one row per entry from new-shape auras[]', () => {
    setupForToken({
      id: 't1', name: 'T', col: 0, row: 0,
      auras: [
        { radius: 1, color: '#4a9eff' },
        { radius: 3, color: '#1D9E75' },
      ],
    });
    expect(screen.getByLabelText(/aura 1 radius/i).value).toBe('1');
    expect(screen.getByLabelText(/aura 2 radius/i).value).toBe('3');
  });

  it('Add aura appends a row; Remove drops the targeted row', async () => {
    setupForToken({ id: 't1', name: 'T', col: 0, row: 0 });
    fireEvent.click(screen.getByRole('button', { name: /add aura/i }));
    fireEvent.click(screen.getByRole('button', { name: /add aura/i }));
    expect(screen.getByLabelText(/aura 1 radius/i)).toBeTruthy();
    expect(screen.getByLabelText(/aura 2 radius/i)).toBeTruthy();
    // Remove the FIRST aura
    fireEvent.click(screen.getByRole('button', { name: /remove aura 1/i }));
    expect(screen.queryByLabelText(/aura 2 radius/i)).toBeNull();
    expect(screen.getByLabelText(/aura 1 radius/i)).toBeTruthy();
  });

  it('Submit writes auras[] and zeroes legacy aura_radius/aura_color', async () => {
    const ui = makeUi();
    setupForToken({
      id: 't1', name: 'Alice', col: 2, row: 2,
      hp_current: 10, hp_max: 10, ac: 12, color: '#185FA5',
      auras: [{ radius: 2, color: '#4a9eff' }],
    }, ui);
    // Tweak the first aura, then add a second
    const r1 = screen.getByLabelText(/aura 1 radius/i);
    fireEvent.input(r1, { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: /add aura/i }));
    const r2 = screen.getByLabelText(/aura 2 radius/i);
    fireEvent.input(r2, { target: { value: '1' } });
    // Submit the form
    fireEvent.submit(document.getElementById('token-form'));
    await Promise.resolve(); await Promise.resolve();
    expect(ui.updateToken).toHaveBeenCalled();
    const [, patch] = ui.updateToken.mock.calls[0];
    expect(patch.auras).toEqual([
      { radius: 4, color: '#4a9eff' },
      { radius: 1, color: '#4a9eff' },
    ]);
    // Legacy fields retired
    expect(patch.aura_radius).toBe(0);
    expect(patch.aura_color).toBeNull();
  });

  it('rows with radius 0 are dropped at submit time', async () => {
    const ui = makeUi();
    setupForToken({ id: 't1', name: 'T', col: 0, row: 0 }, ui);
    fireEvent.click(screen.getByRole('button', { name: /add aura/i }));
    fireEvent.input(screen.getByLabelText(/aura 1 radius/i), { target: { value: '0' } });
    fireEvent.submit(document.getElementById('token-form'));
    await Promise.resolve(); await Promise.resolve();
    const [, patch] = ui.updateToken.mock.calls[0];
    expect(patch.auras).toEqual([]);
  });
});
