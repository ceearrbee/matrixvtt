
import { openSettingsModal as openSettingsFn } from './Settings.jsx';
import { showEntityForm as showEntityFormFn } from './EntityForm.jsx';
import {
  showTokenForm as showTokenFormFn,
  duplicateToken as duplicateTokenFn,
} from './tokens-panel.js';
import { showCharacterWizard as showCharacterWizardFn } from './character-wizard.js';
import { showSpellForm as showSpellFormFn } from './spells-tab.js';
import {
  showItemForm as showItemFormFn,
  showEditItemForm as showEditItemFormFn,
} from './items-tab.js';
import {
  showHandoutForm as showHandoutFormFn,
} from './handouts-panel.js';
import { openDoc as openDocFn } from './FloatingDoc.jsx';
import { showTableForm as showTableFormFn } from './tables/TableFormModal.jsx';
import {
  showFirstTimeSetup as showFirstTimeSetupFn,
  showPlayerWelcome as showPlayerWelcomeFn,
} from './first-time-setup.js';
import {
  // Aliased for clarity at the call site: the underlying AttackModal.jsx
  // exports are named `openAttackResolveModal` (the outer attack dialog)
  // and `openAttackSelectModal` (target-picker when attacking).
  openAttackResolveModal as showAttackModal,
  openAttackSelectModal as showAttackFromTargetModal,
} from './AttackModal.jsx';
import {
  showCharacterPreview as showCharacterPreviewFn,
  showNPCPreview as showNPCPreviewFn,
  showItemPreview as showItemPreviewFn,
  showSpellPreview as showSpellPreviewFn,
  castSpell as castSpellFn,
  consumeItem as consumeItemFn,
} from './preview/preview-modals.js';
import { previewToken as previewTokenFn } from './preview/preview-token.js';
import { ENTITY_TYPES } from '../utils/constants.js';

export function attachModalMethods(ui) {
  // Top-level modals
  ui.openSettings = () => openSettingsFn(ui);
  // MapsPanel is lazy-loaded to keep the canvas-only bundles lean.
  ui.openMapsPanel = (selectedMapId = null) =>
    import('./MapsPanel.jsx').then((m) => m.openMapsPanel(ui, selectedMapId));

  // Character / NPC forms - two wrappers that force the entity type
  // keep callers from confusing PC/NPC paths.
  ui.showEntityForm = (type = ENTITY_TYPES.PC, id = null) => showEntityFormFn(ui, type, id);
  ui.showEditCharacterForm = (id) => showEntityFormFn(ui, ENTITY_TYPES.PC, id);
  ui.showAddNPCForm = () => showEntityFormFn(ui, ENTITY_TYPES.NPC);

  // Token / item / spell editors
  ui.showTokenForm = (id = null) => showTokenFormFn(ui, id);
  ui.showCharacterWizard = () => showCharacterWizardFn(ui);
  ui.showSpellForm = (id = null) => showSpellFormFn(ui, id);
  ui.showItemForm = (id = null) => showItemFormFn(ui, id);
  ui.showEditItemForm = (id) => showEditItemFormFn(ui, id);
  ui.duplicateToken = (id) => duplicateTokenFn(ui, id);

  // Handout / table
  ui.showHandoutForm = (id = null) => showHandoutFormFn(ui, id);
  ui.showHandoutModal = (id) => openDocFn('handout', id);
  ui.showTableForm = (id = null) => showTableFormFn(ui, id);

  // First-time / welcome
  ui.showFirstTimeSetup = (opts) => showFirstTimeSetupFn(ui, opts);
  ui.showPlayerWelcome = () => showPlayerWelcomeFn(ui);

  // Attack flow - underscore-prefixed because they're internal to the
  // combat pipeline, not user-facing UI surface.
  ui._showAttackModal = (tid, data, targetId = null) => showAttackModal(ui, tid, data, targetId);
  ui._showAttackFromTargetModal = (tid) => showAttackFromTargetModal(ui, tid);

  // Read-only-but-interactive previews for entity / item cards.
  // Driven by `<x>_preview.sections` in the active ruleset, with
  // fallback to the existing sheet / item_card sections.
  ui.showCharacterPreview = (id) => showCharacterPreviewFn(ui, id);
  ui.showNPCPreview = (id) => showNPCPreviewFn(ui, id);
  ui.showItemPreview = (id) => showItemPreviewFn(ui, id);
  ui.showSpellPreview = (id, casterId = null) => showSpellPreviewFn(ui, id, casterId);
  ui.previewToken = (tokenId) => previewTokenFn(ui, tokenId);

  ui.castSpell = (id, casterId = null) => castSpellFn(ui, id, casterId);
  ui.consumeItem = (id) => consumeItemFn(ui, id);
}
