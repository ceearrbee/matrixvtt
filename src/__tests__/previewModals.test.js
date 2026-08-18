/**
 * Preview helpers open a ModalFactory dialog whose body dispatches
 * the ruleset's `<x>_preview.sections` (with fallback to sheet/card).
 * Item preview routes attack/damage/use clicks via delegated
 * data-item-action attributes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { showItemPreview, showCharacterPreview } from '../ui/preview/preview-modals.js';

vi.mock('../ui/dice-helpers.js', () => ({
  fireFormulaRoll: vi.fn(),
  getRollFormula: vi.fn(() => '1d20+{bonus}'),
  expandFormula: vi.fn((_ui, t, ctx) => t.replace('{bonus}', String(ctx.bonus ?? 0))),
}));

import { fireFormulaRoll } from '../ui/dice-helpers.js';

function makeUi(overrides = {}) {
  const items = new Map([
    ['itm-sword', { id: 'itm-sword', name: 'Shortsword', attack_bonus: 4, damage: '1d6', damage_type: 'piercing' }],
    ['itm-potion', { id: 'itm-potion', name: 'Healing Potion', consumable: true, quantity: 2 }],
  ]);
  const characters = new Map([
    ['chr-1', { id: 'chr-1', name: 'Aria', hp_max: 30, hp_current: 30, attributes: { str: 10 }, skills: {} }],
  ]);
  return {
    state: {
      items,
      characters,
      npcs: new Map(),
      tokens: new Map(),
      tables: new Map(),
      handouts: new Map(),
      settings: {
        systemConfig: {
          item_preview: { sections: [
            { kind: 'description' },
            { kind: 'attack_roll' },
            { kind: 'damage_roll' },
            { kind: 'use_consumable' },
          ] },
          character_preview: { sections: [{ kind: 'resource_track', id: 'hp' }] },
          rolls: { attack: '1d20+{bonus}' },
        },
      },
      canEditEntity: () => false,
      isGM: () => false,
      getCurrentCharacter: () => null,
      updateItem: vi.fn(async () => true),
    },
    widgetManager: { userId: '@me:s' },
    selectCharacterById: vi.fn(),
    selectNPCById: vi.fn(),
    showItemForm: vi.fn(),
    showEditCharacterForm: vi.fn(),
    showEntityForm: vi.fn(),
    _log: vi.fn(),
    ...overrides,
  };
}

describe('showItemPreview', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    fireFormulaRoll.mockClear();
  });

  it('opens a modal with the item title and Close button', () => {
    const ui = makeUi();
    showItemPreview(ui, 'itm-sword');
    const modal = document.getElementById('preview-modal');
    expect(modal).not.toBeNull();
    expect(modal.querySelector('h2')?.textContent).toBe('Shortsword');
    expect(modal.querySelector('[data-modal-close]')).not.toBeNull();
  });

  it('attack-roll button fires fireFormulaRoll with the ruleset attack formula', () => {
    const ui = makeUi();
    showItemPreview(ui, 'itm-sword');
    const btn = document.querySelector('[data-item-action="attack-roll"]');
    expect(btn).not.toBeNull();
    btn.click();
    expect(fireFormulaRoll).toHaveBeenCalledWith(
      ui,
      expect.stringContaining('1d20+4'),
      expect.stringContaining('attack'),
    );
  });

  it('damage-roll button fires fireFormulaRoll with the damage formula', () => {
    const ui = makeUi();
    showItemPreview(ui, 'itm-sword');
    document.querySelector('[data-item-action="damage-roll"]').click();
    expect(fireFormulaRoll).toHaveBeenCalledWith(
      ui,
      '1d6',
      expect.stringContaining('damage'),
    );
  });

  it('use-consumable button decrements quantity', async () => {
    const ui = makeUi();
    showItemPreview(ui, 'itm-potion');
    const btn = document.querySelector('[data-item-action="use-consumable"]');
    expect(btn).not.toBeNull();
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(ui.state.updateItem).toHaveBeenCalledWith(
      'itm-potion',
      expect.objectContaining({ quantity: 1 }),
    );
  });
});

describe('showCharacterPreview', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('opens a modal titled with the character name', () => {
    const ui = makeUi();
    showCharacterPreview(ui, 'chr-1');
    const modal = document.getElementById('preview-modal');
    expect(modal).not.toBeNull();
    expect(modal.querySelector('h2')?.textContent).toBe('Aria');
  });

  it('"View Full Sheet" button closes modal + invokes selectCharacterById', () => {
    const ui = makeUi();
    showCharacterPreview(ui, 'chr-1');
    const buttons = [...document.querySelectorAll('button')];
    const view = buttons.find((b) => b.textContent.trim() === 'View Full Sheet');
    expect(view).toBeTruthy();
    view.click();
    expect(ui.selectCharacterById).toHaveBeenCalledWith('chr-1');
    expect(document.getElementById('preview-modal')).toBeNull();
  });

  it('falls back to character_sheet when character_preview missing', () => {
    const ui = makeUi();
    delete ui.state.settings.systemConfig.character_preview;
    ui.state.settings.systemConfig.character_sheet = { sections: [{ kind: 'notes' }] };
    showCharacterPreview(ui, 'chr-1');
    expect(document.getElementById('preview-modal')).not.toBeNull();
  });
});
