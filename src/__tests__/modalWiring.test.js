/**
 * Modal & panel wiring, split out of ui-methods.js. Each method
 * opens a modal / panel by delegating to a feature module.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../ui/Settings.jsx', () => ({ openSettingsModal: vi.fn() }));
vi.mock('../ui/EntityForm.jsx', () => ({ showEntityForm: vi.fn() }));
vi.mock('../ui/tokens-panel.js', () => ({
  showTokenForm: vi.fn(),
  duplicateToken: vi.fn(),
}));
vi.mock('../ui/character-wizard.js', () => ({ showCharacterWizard: vi.fn() }));
vi.mock('../ui/spells-tab.js', () => ({ showSpellForm: vi.fn() }));
vi.mock('../ui/items-tab.js', () => ({ showItemForm: vi.fn(), showEditItemForm: vi.fn() }));
vi.mock('../ui/handouts-panel.js', () => ({
  showHandoutForm: vi.fn(),
}));
vi.mock('../ui/FloatingDoc.jsx', () => ({
  openDoc: vi.fn(),
}));
vi.mock('../ui/tables/TableFormModal.jsx', () => ({ showTableForm: vi.fn() }));
vi.mock('../ui/first-time-setup.js', () => ({
  showFirstTimeSetup: vi.fn(),
  showPlayerWelcome: vi.fn(),
}));
vi.mock('../ui/AttackModal.jsx', () => ({
  openAttackResolveModal: vi.fn(),
  openAttackSelectModal: vi.fn(),
}));

import { attachModalMethods } from '../ui/modal-wiring.js';
import * as Settings from '../ui/Settings.jsx';
import * as entityForm from '../ui/EntityForm.jsx';
import * as tokensPanel from '../ui/tokens-panel.js';
import * as charWizard from '../ui/character-wizard.js';
import * as spellsTab from '../ui/spells-tab.js';
import * as itemsTab from '../ui/items-tab.js';
import * as handouts from '../ui/handouts-panel.js';
import * as floatingDoc from '../ui/FloatingDoc.jsx';
import * as tableForm from '../ui/tables/TableFormModal.jsx';
import * as firstTimeSetup from '../ui/first-time-setup.js';
import * as attackModal from '../ui/AttackModal.jsx';
import { ENTITY_TYPES } from '../utils/constants.js';

function makeUI() { return {}; }

describe('attachModalMethods(ui)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('openSettings forwards to Settings.openSettingsModal(ui)', () => {
    const ui = makeUI(); attachModalMethods(ui); ui.openSettings();
    expect(Settings.openSettingsModal).toHaveBeenCalledWith(ui);
  });

  it('showEntityForm forwards (ui, type, id) with PC default', () => {
    const ui = makeUI(); attachModalMethods(ui);
    ui.showEntityForm();
    expect(entityForm.showEntityForm).toHaveBeenCalledWith(ui, ENTITY_TYPES.PC, null);
    ui.showEntityForm(ENTITY_TYPES.NPC, 'npc-1');
    expect(entityForm.showEntityForm).toHaveBeenLastCalledWith(ui, ENTITY_TYPES.NPC, 'npc-1');
  });

  it('showEditCharacterForm forces the PC type', () => {
    const ui = makeUI(); attachModalMethods(ui);
    ui.showEditCharacterForm('chr-aria');
    expect(entityForm.showEntityForm).toHaveBeenCalledWith(ui, ENTITY_TYPES.PC, 'chr-aria');
  });

  it('showAddNPCForm forces the NPC type with no id', () => {
    const ui = makeUI(); attachModalMethods(ui);
    ui.showAddNPCForm();
    expect(entityForm.showEntityForm).toHaveBeenCalledWith(ui, ENTITY_TYPES.NPC);
  });

  it('showTokenForm / showCharacterWizard / showSpellForm / showItemForm / showEditItemForm all forward', () => {
    const ui = makeUI(); attachModalMethods(ui);
    ui.showTokenForm('tok-1');
    ui.showCharacterWizard();
    ui.showSpellForm('spl-1');
    ui.showItemForm('itm-1');
    ui.showEditItemForm('itm-1');
    expect(tokensPanel.showTokenForm).toHaveBeenCalledWith(ui, 'tok-1');
    expect(charWizard.showCharacterWizard).toHaveBeenCalledWith(ui);
    expect(spellsTab.showSpellForm).toHaveBeenCalledWith(ui, 'spl-1');
    expect(itemsTab.showItemForm).toHaveBeenCalledWith(ui, 'itm-1');
    expect(itemsTab.showEditItemForm).toHaveBeenCalledWith(ui, 'itm-1');
  });

  it('handout / table modals forward', () => {
    const ui = makeUI(); attachModalMethods(ui);
    ui.showHandoutForm('h-1');
    ui.showHandoutModal('h-1');
    ui.showTableForm('tbl-1');
    expect(handouts.showHandoutForm).toHaveBeenCalledWith(ui, 'h-1');
    // showHandoutModal now opens the shared floating viewer.
    expect(floatingDoc.openDoc).toHaveBeenCalledWith('handout', 'h-1');
    expect(tableForm.showTableForm).toHaveBeenCalledWith(ui, 'tbl-1');
  });

  it('showFirstTimeSetup and showPlayerWelcome forward', () => {
    const ui = makeUI(); attachModalMethods(ui);
    ui.showFirstTimeSetup({ reason: 'x' });
    ui.showPlayerWelcome();
    expect(firstTimeSetup.showFirstTimeSetup).toHaveBeenCalledWith(ui, { reason: 'x' });
    expect(firstTimeSetup.showPlayerWelcome).toHaveBeenCalledWith(ui);
  });

  it('_showAttackModal and _showAttackFromTargetModal forward', () => {
    const ui = makeUI(); attachModalMethods(ui);
    ui._showAttackModal('tok-a', { bonus: 5 });
    ui._showAttackFromTargetModal('tok-b');
    expect(attackModal.openAttackResolveModal).toHaveBeenCalledWith(ui, 'tok-a', { bonus: 5 }, null);
    expect(attackModal.openAttackSelectModal).toHaveBeenCalledWith(ui, 'tok-b');
  });

  it('duplicateToken forwards (ui, id)', () => {
    const ui = makeUI(); attachModalMethods(ui);
    ui.duplicateToken('tok-9');
    expect(tokensPanel.duplicateToken).toHaveBeenCalledWith(ui, 'tok-9');
  });
});
