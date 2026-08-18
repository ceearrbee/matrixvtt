/**
 * Spell schema missing fields - higher_level (upcasting description) and source/page reference.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSpell, updateSpell, showSpellForm } from '../ui/spells-tab.js';
import { render } from '@testing-library/preact';
import { h } from 'preact';
import { Spells } from '../ui/Spells.jsx';
import { withFacade } from './helpers/withFacade.js';

function makeModal(overrides = {}) {
  const fields = {
    '#spell-name':         'Fireball',
    '#spell-level':        '3',
    '#spell-school':       'Evocation',
    '#spell-casting-time': '1 action',
    '#spell-range':        '150 feet',
    '#spell-duration':     'Instantaneous',
    '#spell-components':   'V, S, M',
    '#spell-description':  'A bright streak flashes.',
    '#spell-damage':       '8d6',
    '#spell-damage-type':  'fire',
    '#spell-save':         'dex',
    '#spell-higher-level': 'When cast at 4th level or higher, the damage increases by 1d6.',
    '#spell-source':       'PHB',
    '#spell-page':         '241',
    ...overrides,
  };
  return {
    querySelector: (sel) => {
      if (sel === '#spell-concentration' || sel === '#spell-ritual') return { checked: false };
      const val = fields[sel];
      return val !== undefined ? { value: val } : null;
    },
  };
}

function makeUI(existingSpell = null) {
  const spells = new Map();
  if (existingSpell) spells.set('spl-1', existingSpell);
  const state = withFacade({
    spells,
    characters: new Map([['char-1', { spell_ids: existingSpell ? ['spl-1'] : [], spell_slots: {} }]]),
    getCurrentCharacter: () => ({ spell_ids: existingSpell ? ['spl-1'] : [], spell_slots: {} }),
    getCurrentCharacterId: () => 'char-1',
    canEditEntity: () => true,
    sendStateEvent: vi.fn().mockResolvedValue(undefined),
    settings: {},
  });
  return { state, _toast: vi.fn() };
}

describe('createSpell - higher_level and source/page fields', () => {
  it('stores higher_level when provided', async () => {
    const ui = makeUI();
    const modal = makeModal();
    await createSpell(ui, modal);
    const saved = [...ui.state.spells.values()][0];
    expect(saved.higher_level).toBe('When cast at 4th level or higher, the damage increases by 1d6.');
  });

  it('stores source when provided', async () => {
    const ui = makeUI();
    await createSpell(ui, makeModal());
    const saved = [...ui.state.spells.values()][0];
    expect(saved.source).toBe('PHB');
  });

  it('stores page when provided', async () => {
    const ui = makeUI();
    await createSpell(ui, makeModal());
    const saved = [...ui.state.spells.values()][0];
    expect(saved.page).toBe('241');
  });

  it('stores null for higher_level when blank', async () => {
    const ui = makeUI();
    await createSpell(ui, makeModal({ '#spell-higher-level': '' }));
    const saved = [...ui.state.spells.values()][0];
    expect(saved.higher_level).toBeNull();
  });
});

describe('updateSpell - higher_level and source/page fields', () => {
  it('updates higher_level on edit', async () => {
    const existing = { name: 'Fireball', level: 3, school: 'Evocation', higher_level: 'old text', source: 'PHB', page: '241' };
    const ui = makeUI(existing);
    const modal = makeModal({ '#spell-higher-level': 'New upcasting text', '#spell-source': 'SRD', '#spell-page': '10' });
    await updateSpell(ui, modal, 'spl-1');
    const saved = ui.state.spells.get('spl-1');
    expect(saved.higher_level).toBe('New upcasting text');
    expect(saved.source).toBe('SRD');
    expect(saved.page).toBe('10');
  });
});

// Inline-body display tests removed: spell cards no longer render
// their full body inline. Source / page / higher_level surface inside
// the preview popup (`src/ui/spell-preview-sections.js`) - see
// spellPreviewKinds.test.js for that contract.
