/**
 * `spell_book` - sheet section that lists the character's known
 * spells grouped by level. Each spell is clickable to open the spell
 * preview; level header shows slot used/total ratio when slots are
 * declared. Cantrips (level 0) have no slot tracker.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { _kindsForTest } from '../ui/characterSheetSections.js';

function makeUi({ spells = new Map() } = {}) {
  return {
    state: {
      canEditEntity: () => true,
      isGM: () => true,
      settings: { systemConfig: {} },
      spells,
    },
    showSpellPreview: vi.fn(),
  };
}

const spells = (...arr) => {
  const m = new Map();
  for (const s of arr) m.set(s.id, s);
  return m;
};

const fireBolt = { id: 'sp-fb', name: 'Fire Bolt', level: 0 };
const magicMissile = { id: 'sp-mm', name: 'Magic Missile', level: 1 };
const shield = { id: 'sp-sh', name: 'Shield', level: 1 };
const fireball = { id: 'sp-fr', name: 'Fireball', level: 3 };

beforeEach(() => { document.body.innerHTML = ''; });

describe('spell_book section', () => {
  it('groups spells by level with a header per level', () => {
    const ui = makeUi({ spells: spells(fireBolt, magicMissile, shield, fireball) });
    const character = {
      id: 'c1',
      spell_ids: ['sp-fb', 'sp-mm', 'sp-sh', 'sp-fr'],
      spell_slots: { '1': { total: 4, used: 1 }, '3': { total: 2, used: 0 } },
    };
    render(_kindsForTest.spell_book({ ui, character, config: { kind: 'spell_book' } }));
    expect(screen.getByText(/cantrips/i)).toBeTruthy();
    expect(screen.getByText(/level 1/i)).toBeTruthy();
    expect(screen.getByText(/level 3/i)).toBeTruthy();
    expect(screen.getByText('Fire Bolt')).toBeTruthy();
    expect(screen.getByText('Magic Missile')).toBeTruthy();
    expect(screen.getByText('Fireball')).toBeTruthy();
  });

  it('level header shows used/total when slots are declared', () => {
    const ui = makeUi({ spells: spells(magicMissile) });
    const character = { id: 'c1', spell_ids: ['sp-mm'], spell_slots: { '1': { total: 4, used: 1 } } };
    const { container } = render(_kindsForTest.spell_book({ ui, character, config: { kind: 'spell_book' } }));
    expect(container.textContent).toMatch(/level 1/i);
    // Either "3/4" (remaining/total) or "1/4 used" - accept either
    expect(container.textContent).toMatch(/(3\/4|1\/4)/);
  });

  it('clicking a spell opens its preview', () => {
    const ui = makeUi({ spells: spells(magicMissile) });
    const character = { id: 'c1', spell_ids: ['sp-mm'] };
    render(_kindsForTest.spell_book({ ui, character, config: { kind: 'spell_book' } }));
    fireEvent.click(screen.getByText('Magic Missile'));
    expect(ui.showSpellPreview).toHaveBeenCalledWith('sp-mm');
  });

  it('ignores spell_ids that resolve to nothing', () => {
    const ui = makeUi({ spells: spells(magicMissile) });
    const character = { id: 'c1', spell_ids: ['sp-mm', 'sp-missing'] };
    render(_kindsForTest.spell_book({ ui, character, config: { kind: 'spell_book' } }));
    expect(screen.getByText('Magic Missile')).toBeTruthy();
    expect(screen.queryByText('sp-missing')).toBeNull();
  });

  it('renders the empty state when the character knows no spells', () => {
    const ui = makeUi();
    const character = { id: 'c1', spell_ids: [] };
    render(_kindsForTest.spell_book({ ui, character, config: { kind: 'spell_book' } }));
    expect(screen.getByText(/no spells|nothing prepared/i)).toBeTruthy();
  });
});
