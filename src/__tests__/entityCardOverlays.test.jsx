/**
 * Character-card status line, driven by the ruleset the same way token
 * overlays are: `character_card.overlays[]` with the resource_bar /
 * pip_track / badge vocabulary. Without the block the card falls back
 * to the legacy HP bar (when hp fields exist).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, h } from 'preact';
import { EntityList } from '../ui/EntityList.jsx';
import { CardOverlays, pipStates } from '../ui/entity-card-overlays.jsx';
import { ENTITY_TYPES } from '../utils/constants.js';

describe('pipStates', () => {
  it('reads a flat boolean array (applyHarm stress shape)', () => {
    expect(pipStates({ stress: [true, false, true] }, { field: 'stress', count: 3 }))
      .toEqual([true, false, true]);
  });

  it('flattens the box_track record shape', () => {
    const entity = { stress: { 'Dice lost': [true, true, false, false, false, false] } };
    expect(pipStates(entity, { field: 'stress', count: 6 }))
      .toEqual([true, true, false, false, false, false]);
  });

  it('pads to count when the field is missing', () => {
    expect(pipStates({}, { field: 'stress', count: 2 })).toEqual([false, false]);
  });
});

describe('CardOverlays', () => {
  function mount(entity, overlays) {
    const host = document.createElement('div');
    render(h(CardOverlays, { entity, overlays }), host);
    return host;
  }

  it('renders a labeled pip track', () => {
    const host = mount(
      { stress: [true, false, false, false, false, false] },
      [{ kind: 'pip_track', field: 'stress', count: 6, label: 'Dice lost' }],
    );
    expect(host.textContent).toContain('Dice lost');
    expect(host.querySelectorAll('.card-pip')).toHaveLength(6);
    expect(host.querySelectorAll('.card-pip--filled')).toHaveLength(1);
  });

  it('renders a labeled resource bar', () => {
    const host = mount(
      { fp_current: 3, fp_max: 12 },
      [{ kind: 'resource_bar', label: 'FP', current_field: 'fp_current', max_field: 'fp_max' }],
    );
    expect(host.textContent).toContain('FP:');
    expect(host.textContent).toContain('3 / 12');
    expect(host.querySelector('.hp-bar')).toBeTruthy();
  });

  it('skips unknown kinds', () => {
    const host = mount({}, [{ kind: 'sparkline', field: 'x' }]);
    expect(host.textContent).toBe('');
  });

  it('text kind joins record values', () => {
    const host = mount(
      { cliches: { cliche1: 'Swashbuckler', cliche2: 'Hacker', cliche3: '' } },
      [{ kind: 'text', field: 'cliches' }],
    );
    expect(host.textContent).toBe('Swashbuckler · Hacker');
  });

  it('text kind pairs slot values with matching attribute ratings', () => {
    const host = mount(
      {
        cliches: { cliche1: 'Swashbuckler', cliche2: 'Hacker' },
        attributes: { cliche1: 4, cliche2: 3 },
      },
      [{ kind: 'text', field: 'cliches', with_attribute_ratings: true }],
    );
    expect(host.textContent).toBe('Swashbuckler 4 · Hacker 3');
  });

  it('text kind renders plain strings and arrays, hides when empty', () => {
    expect(mount({ motto: 'No refunds' }, [{ kind: 'text', field: 'motto' }]).textContent)
      .toBe('No refunds');
    expect(mount({ tags: ['fast', 'loud'] }, [{ kind: 'text', field: 'tags' }]).textContent)
      .toBe('fast · loud');
    expect(mount({}, [{ kind: 'text', field: 'cliches' }]).textContent).toBe('');
  });
});

describe('EntityCard uses ruleset card overlays', () => {
  function mkUi(entity, systemConfig) {
    return /** @type {any} */ ({
      state: {
        isGM: () => false,
        characters: new Map([[entity.id, entity]]),
        npcs: new Map(),
        canEditEntity: () => false,
        settings: { systemConfig },
      },
      widgetManager: { userId: '@me:s' },
      selectCharacterById: vi.fn(),
      showCharacterWizard: vi.fn(),
      showEntityForm: vi.fn(),
    });
  }

  it('renders the ruleset overlays instead of the HP fallback', () => {
    const entity = { id: 'c1', name: 'Toast', type: ENTITY_TYPES.PC, stress: [true, false, false, false, false, false] };
    const ui = mkUi(entity, {
      character_card: { overlays: [{ kind: 'pip_track', field: 'stress', count: 6, label: 'Dice lost' }] },
    });
    const host = document.createElement('div');
    render(h(EntityList, { ui, type: ENTITY_TYPES.PC }), host);
    expect(host.querySelectorAll('.card-pip')).toHaveLength(6);
    expect(host.textContent).not.toContain('HP:');
  });
});
