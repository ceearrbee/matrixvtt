/**
 * Vision has a form.
 *
 * `vision_radius` and `darkvision_radius` are schema-validated and the
 * vision mask reads both, but no form could set either, so the sight
 * radius of every hand-made token was zero and the fog never opened
 * around it. The token form now carries both, seeded from the
 * `default_vision_radius` setting, which is what finally gives that
 * setting a reader.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { showTokenFormModal } from '../ui/TokenFormModal.jsx';
import { tokensSignal } from '../state/signals.js';
import { setCombatSetting } from '../utils/combat-settings.js';
import { STORAGE_KEYS } from '../utils/constants.js';
import { validateToken } from '../utils/schemas/actors.js';

function makeUi(token) {
  const tokens = new Map();
  if (token) tokens.set(token.id, token);
  tokensSignal.value = new Map(tokens);
  return {
    state: { tokens, settings: { systemConfig: null } },
    updateToken: vi.fn().mockResolvedValue(true),
    createToken: vi.fn().mockResolvedValue(true),
    widgetManager: { uploadMedia: vi.fn(), userId: '@me:hs' },
    _toast: vi.fn(),
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.removeItem(STORAGE_KEYS.COMBAT_AUTOMATION);
});

describe('token form vision fields', () => {
  it('offers a sight radius and a darkvision radius', () => {
    showTokenFormModal(makeUi(null));
    expect(screen.getByLabelText(/sight radius/i)).toBeTruthy();
    expect(screen.getByLabelText(/darkvision radius/i)).toBeTruthy();
  });

  it('seeds a new token from default_vision_radius', () => {
    setCombatSetting('default_vision_radius', 45);
    showTokenFormModal(makeUi(null));
    expect(screen.getByLabelText(/sight radius/i).value).toBe('45');
  });

  it('shows the stored radii when editing', () => {
    const token = { id: 't1', name: 'T', col: 0, row: 0, vision_radius: 60, darkvision_radius: 15 };
    showTokenFormModal(makeUi(token), 't1');
    expect(screen.getByLabelText(/sight radius/i).value).toBe('60');
    expect(screen.getByLabelText(/darkvision radius/i).value).toBe('15');
  });

  it('writes typed radii through to the token', async () => {
    const token = { id: 't1', name: 'T', col: 0, row: 0 };
    const ui = makeUi(token);
    showTokenFormModal(ui, 't1');
    fireEvent.input(screen.getByLabelText(/sight radius/i), { target: { value: '30' } });
    fireEvent.input(screen.getByLabelText(/darkvision radius/i), { target: { value: '60' } });
    fireEvent.submit(document.getElementById('token-form'));
    await Promise.resolve(); await Promise.resolve();
    const [, patch] = ui.updateToken.mock.calls[0];
    expect(patch.vision_radius).toBe(30);
    expect(patch.darkvision_radius).toBe(60);
  });

  it('writes radii the token schema accepts', async () => {
    const ui = makeUi({ id: 't1', name: 'T', col: 0, row: 0 });
    showTokenFormModal(ui, 't1');
    fireEvent.input(screen.getByLabelText(/sight radius/i), { target: { value: '30' } });
    fireEvent.submit(document.getElementById('token-form'));
    await Promise.resolve(); await Promise.resolve();
    const [, patch] = ui.updateToken.mock.calls[0];
    expect(() => validateToken({ id: 't1', map_id: 'm', sheet_id: null, col: 0, row: 0, ...patch })).not.toThrow();
  });
});
