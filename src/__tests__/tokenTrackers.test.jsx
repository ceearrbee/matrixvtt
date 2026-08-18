/**
 * Token trackers - per-token generic counters (ammo, ki, spell slots,
 * sanity, anything). PlanarAlly's per-token trackers, MatrixVTT-flavoured.
 *
 * Storage shape:
 *   token.trackers = [{ label: string, value: number, max?: number }]
 *
 * Render: InitiativeEntry shows trackers inline as small badges after
 * the conditions strip. Edit: TokenFormModal grows a tracker list
 * editor next to auras.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { h } from 'preact';
import { TokenTrackerBadges } from '../ui/InitiativeEntry.jsx';
import { tokensSignal, charactersSignal, npcsSignal } from '../state/signals.js';
import { showTokenFormModal } from '../ui/TokenFormModal.jsx';
import { validateToken } from '../utils/schemas/actors.js';

function makeUi(token) {
  const tokens = new Map();
  if (token) tokens.set(token.id, token);
  tokensSignal.value = new Map(tokens);
  return {
    state: {
      tokens,
      initiative: { active: true, order: [], current_index: 0 },
      widgetManager: { userId: '@me:hs' },
    },
    updateToken: vi.fn().mockResolvedValue(true),
    createToken: vi.fn().mockResolvedValue(true),
    widgetManager: { uploadMedia: vi.fn(), userId: '@me:hs' },
    _toast: vi.fn(),
    previewToken: vi.fn(),
    rollMyInitiative: vi.fn(),
    setInitiativeRoll: vi.fn(),
    reorderInitiative: vi.fn(),
    adjustTokenHP: vi.fn(),
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  charactersSignal.value = new Map();
  npcsSignal.value = new Map();
});

describe('token trackers - schema', () => {
  const base = { id: 't1', map_id: 'm', sheet_id: null, col: 0, row: 0 };

  it('accepts a well-formed trackers array', () => {
    expect(validateToken({
      ...base,
      trackers: [
        { label: 'Ammo', value: 12, max: 20 },
        { label: 'Ki',   value: 3 },
      ],
    })).toBe(true);
  });

  it('accepts an empty trackers array', () => {
    expect(validateToken({ ...base, trackers: [] })).toBe(true);
  });

  it('omitting trackers entirely is valid', () => {
    expect(validateToken(base)).toBe(true);
  });

  it('rejects a non-array trackers field', () => {
    expect(() => validateToken({ ...base, trackers: 'nope' })).toThrow(/trackers/);
  });

  it('rejects a tracker without a label', () => {
    expect(() => validateToken({ ...base, trackers: [{ value: 1 }] })).toThrow(/label/);
  });

  it('rejects a tracker with a non-numeric value', () => {
    expect(() => validateToken({ ...base, trackers: [{ label: 'X', value: 'no' }] })).toThrow(/value/);
  });
});

describe('token trackers - badge rendering', () => {
  it('renders nothing when trackers is absent', () => {
    const { container } = render(h(TokenTrackerBadges, { trackers: undefined }));
    expect(container.querySelector('.ie__trackers')).toBeNull();
  });

  it('renders nothing when trackers is an empty array', () => {
    const { container } = render(h(TokenTrackerBadges, { trackers: [] }));
    expect(container.querySelector('.ie__trackers')).toBeNull();
  });

  it('renders one badge per tracker with label + value', () => {
    const { container } = render(h(TokenTrackerBadges, {
      trackers: [
        { label: 'Ammo', value: 12, max: 20 },
        { label: 'Ki',   value: 3 },
      ],
      ariaContext: 'Archer',
    }));
    const badges = container.querySelectorAll('.ie__tracker');
    expect(badges.length).toBe(2);
    expect(badges[0].textContent).toMatch(/Ammo/);
    expect(badges[0].textContent).toMatch(/12\s*\/\s*20/);
    expect(badges[1].textContent).toMatch(/Ki/);
    expect(badges[1].textContent).toMatch(/Ki\b.*\b3\b/);
    // No max → no slash
    expect(badges[1].textContent).not.toMatch(/\//);
  });

  it('group has an accessible label scoped to the entity name', () => {
    const { container } = render(h(TokenTrackerBadges, {
      trackers: [{ label: 'Ammo', value: 5 }],
      ariaContext: 'Goblin Boss',
    }));
    expect(container.querySelector('.ie__trackers').getAttribute('aria-label'))
      .toBe('Goblin Boss trackers');
  });
});

describe('token trackers - form editor', () => {
  function setup(token = { id: 't1', name: 'T', col: 0, row: 0 }) {
    const ui = makeUi(token);
    showTokenFormModal(ui, token.id);
    return ui;
  }

  it('shows "No trackers." + Add button when the token has none', () => {
    setup();
    expect(screen.getByText('No trackers.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /add tracker/i })).toBeTruthy();
  });

  it('seeds one row per existing tracker', () => {
    setup({
      id: 't1', name: 'T', col: 0, row: 0,
      trackers: [
        { label: 'Ammo', value: 12, max: 20 },
        { label: 'Ki',   value: 3 },
      ],
    });
    expect(screen.getByLabelText(/tracker 1 label/i).value).toBe('Ammo');
    expect(screen.getByLabelText(/tracker 1 value/i).value).toBe('12');
    expect(screen.getByLabelText(/tracker 1 max/i).value).toBe('20');
    expect(screen.getByLabelText(/tracker 2 label/i).value).toBe('Ki');
  });

  it('Add appends a tracker; Remove drops it', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /add tracker/i }));
    fireEvent.click(screen.getByRole('button', { name: /add tracker/i }));
    expect(screen.getByLabelText(/tracker 1 label/i)).toBeTruthy();
    expect(screen.getByLabelText(/tracker 2 label/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /remove tracker 1/i }));
    expect(screen.queryByLabelText(/tracker 2 label/i)).toBeNull();
  });

  it('Submit writes trackers[] with parsed numeric value/max', async () => {
    const ui = setup({ id: 't1', name: 'T', col: 0, row: 0 });
    fireEvent.click(screen.getByRole('button', { name: /add tracker/i }));
    fireEvent.input(screen.getByLabelText(/tracker 1 label/i), { target: { value: 'Ammo' } });
    fireEvent.input(screen.getByLabelText(/tracker 1 value/i), { target: { value: '15' } });
    fireEvent.input(screen.getByLabelText(/tracker 1 max/i), { target: { value: '20' } });
    fireEvent.submit(document.getElementById('token-form'));
    await Promise.resolve(); await Promise.resolve();
    const [, patch] = ui.updateToken.mock.calls[0];
    expect(patch.trackers).toEqual([{ label: 'Ammo', value: 15, max: 20 }]);
  });

  it('Submit drops trackers with an empty label', async () => {
    const ui = setup();
    fireEvent.click(screen.getByRole('button', { name: /add tracker/i }));
    // Leave label blank
    fireEvent.input(screen.getByLabelText(/tracker 1 value/i), { target: { value: '5' } });
    fireEvent.submit(document.getElementById('token-form'));
    await Promise.resolve(); await Promise.resolve();
    const [, patch] = ui.updateToken.mock.calls[0];
    expect(patch.trackers).toEqual([]);
  });

  it('blank max field saves as omitted (no max)', async () => {
    const ui = setup();
    fireEvent.click(screen.getByRole('button', { name: /add tracker/i }));
    fireEvent.input(screen.getByLabelText(/tracker 1 label/i), { target: { value: 'Ki' } });
    fireEvent.input(screen.getByLabelText(/tracker 1 value/i), { target: { value: '3' } });
    fireEvent.submit(document.getElementById('token-form'));
    await Promise.resolve(); await Promise.resolve();
    const [, patch] = ui.updateToken.mock.calls[0];
    expect(patch.trackers).toEqual([{ label: 'Ki', value: 3 }]);
    expect(patch.trackers[0].max).toBeUndefined();
  });
});
