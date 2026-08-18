/**
 * data-wiring.js - entity CRUD methods attached to the ui controller.
 * Extracted from `ui-methods.js` as part of the ongoing effort to keep
 * that file inside the 300–400 LOC cap.
 *
 * Every method is a thin forward to a feature module; no logic lives
 * here.
 */

import {
  createCharacter as createCharacterFn,
  updateCharacter as updateCharacterFn,
  deleteCharacter as deleteCharacterFn,
  createNPC as createNPCFn,
  updateNPC as updateNPCFn,
  createNPCFromTemplate as createNPCFromTemplateFn,
  deleteNPC as deleteNPCFn,
  claimCharacter as claimCharacterFn,
  unclaimCharacter as unclaimCharacterFn,
  assignNPCController as assignNPCControllerFn,
  releaseNPCController as releaseNPCControllerFn,
  placeSheetOnMap as placeSheetOnMapFn,
} from './entity-manager.js';
import { patchEntity as patchEntityFn } from './entity/patch.js';
import {
  saveCharacterAsTemplate as saveCharacterAsTemplateFn,
  getCharacterTemplates as getCharacterTemplatesFn,
  deleteCharacterTemplate as deleteCharacterTemplateFn,
} from './character-templates.js';
import {
  createItem as createItemFn,
  updateItem as updateItemFn,
  deleteItem as deleteItemFn,
  toggleEquipItem as toggleEquipItemFn,
} from './items-tab.js';
import {
  createSpell as createSpellFn,
  updateSpell as updateSpellFn,
  deleteSpell as deleteSpellFn,
  toggleSpellPrepared as toggleSpellPreparedFn,
  toggleSpellSlotPip as toggleSpellSlotPipFn,
} from './spells-tab.js';
import { rollTable as rollTableFn } from './tables/rollTable.js';
import { deleteTable as deleteTableFn } from './tables/deleteTable.js';
import {
  toggleHandoutVisibility as toggleHandoutVisibilityFn,
  deleteHandout as deleteHandoutFn,
} from './handouts-panel.js';
import { showPageForm as showPageFormFn } from './pages-panel.js';
import { confirmAsync } from './confirm-dialogs.jsx';
import {
  enterScene as enterSceneFn,
  leaveScene as leaveSceneFn,
} from './scene-mode.js';
import {
  openDoc as openDocFn,
  closeDoc as closeDocFn,
  closeAllDocs as closeAllDocsFn,
  bringDocToFront as bringDocToFrontFn,
} from './FloatingDoc.jsx';
import { openDocsSignal } from '../state/ui-signals.js';
import {
  createToken as createTokenFn,
  updateToken as updateTokenFn,
} from './tokens-panel.js';
import {
  cycleSkillProficiency as cycleSkillProficiencyFn,
  showAddSkillOverrideForm as showAddSkillOverrideFormFn,
  deleteSkillOverride as deleteSkillOverrideFn,
} from './skills-tab.js';

export function attachDataMethods(ui) {
  ui.createCharacter = (modal) => createCharacterFn(ui, modal);
  ui.updateCharacter = (modal, id) => updateCharacterFn(ui, modal, id);
  ui.patchEntity = (id, patch) => patchEntityFn(ui, id, patch);
  ui.deleteCharacter = (id) => deleteCharacterFn(ui, id);
  ui.claimCharacter = (id) => claimCharacterFn(ui, id);
  ui.unclaimCharacter = (id) => unclaimCharacterFn(ui, id);
  ui.assignNPCController = (id, userId) => assignNPCControllerFn(ui, id, userId);
  ui.releaseNPCController = (id) => releaseNPCControllerFn(ui, id);
  ui.saveCharacterAsTemplate = (id) => saveCharacterAsTemplateFn(ui, id);
  ui.deleteCharacterTemplate = (idx) => deleteCharacterTemplateFn(ui, idx);
  ui.applyCharacterTemplate = (idx) => {
    const t = getCharacterTemplatesFn(ui.state.settings)[idx];
    if (!t) return;
    const m = document.getElementById('entity-form-modal');
    if (!m) return;
    // getElementById treats the arg as a literal id; querySelector('#'+id)
    // would parse it as a CSS selector and choke on any weird character a
    // template attribute key might contain.
    const val = (id, v) => { const el = m.ownerDocument.getElementById(id); if (el) el.value = v ?? ''; };
    val('entity-name', t.name); val('entity-species', t.species); val('entity-class', t.class_level);
    val('entity-hp-max', t.hp_max); val('entity-hp-current', t.hp_max); val('entity-ac', t.ac);
    val('entity-speed', t.speed); val('entity-init', t.initiative_bonus); val('entity-skills', t.skills);
    val('entity-notes', t.notes);
    if (t.attributes) Object.entries(t.attributes).forEach(([k, v]) => val(`entity-attr-${k}`, v));
  };

  ui.createNPC = (modal) => createNPCFn(ui, modal);
  ui.updateNPC = (modal, id) => updateNPCFn(ui, modal, id);
  ui.deleteNPC = (id) => deleteNPCFn(ui, id);
  ui.createNPCFromTemplate = (tmpl) => createNPCFromTemplateFn(ui, tmpl);
  ui._createNPCFromTemplate = ui.createNPCFromTemplate; // Backwards compatibility for tests
  ui.placeSheetOnMap = (id, type) => placeSheetOnMapFn(ui, id, type);

  ui.createToken = (data) => createTokenFn(ui, data);
  ui.updateToken = (id, data) => updateTokenFn(ui, id, data);

  ui.createItem = (modal) => createItemFn(ui, modal);
  ui.updateItem = (modal, id) => updateItemFn(ui, modal, id);
  ui.deleteItem = (id) => deleteItemFn(ui, id);
  ui.toggleEquipItem = (id) => toggleEquipItemFn(ui, id);

  ui.createSpell = (modal) => createSpellFn(ui, modal);
  ui.updateSpell = (modal, id) => updateSpellFn(ui, modal, id);
  ui.deleteSpell = (id) => deleteSpellFn(ui, id);
  ui.toggleSpellPrepared = (id) => toggleSpellPreparedFn(ui, id);
  ui.toggleSpellSlotPip = (l, i, u, t) => toggleSpellSlotPipFn(ui, l, i, u, t);

  // Handouts + tables
  ui.rollTable = (id) => rollTableFn(ui, id);
  ui.deleteTable = (id) => deleteTableFn(ui, id);
  ui.toggleHandoutVisibility = (id) => toggleHandoutVisibilityFn(ui, id);
  ui.deleteHandout = (id) => deleteHandoutFn(ui, id);

  // Floating doc viewer (handouts + pages share one read surface).
  ui.openDoc = (kind, id) => openDocFn(kind, id);
  ui.closeDoc = (key) => closeDocFn(key);
  ui.closeAllDocs = () => closeAllDocsFn();
  ui.bringDocToFront = (key) => bringDocToFrontFn(key);

  // Scenes (chat threads)
  ui.enterScene = (eventId, title) => enterSceneFn(ui, eventId, title);
  ui.leaveScene = () => leaveSceneFn(ui);

  ui.showPageForm = (editId = null) => showPageFormFn(ui, editId);
  // Legacy names kept as thin redirects so call-sites (command palette,
  // wikilink clicks in older render paths, deep links) keep working.
  ui.showPageView = (id) => openDocFn('page', id);
  ui.closePageView = () => {
    for (const d of openDocsSignal.value) if (d.kind === 'page') closeDocFn(d.key);
  };
  ui.togglePageVisibility = async (id) => {
    const p = ui.state.pages.get(id);
    if (!p) return;
    if (p.visibility === 'private') return; // never auto-cycle a private page
    const next = p.visibility === 'players' ? 'gm' : 'players';
    const userId = ui.state.widgetManager?.userId;
    await ui.state.updatePage(id, { ...p, visibility: next, updated_at: Date.now(), last_editor: userId });
  };
  ui.deletePage = (id) => {
    confirmAsync('This deletes the page for everyone. This can\'t be undone.',
      () => ui.state.deletePage(id),
      { title: 'Delete page', confirmText: 'Delete', busyText: 'Deleting…', confirmClass: 'dbt--danger', id: 'confirm-delete-page' });
  };

  ui.deleteSkillOverride = (key) => deleteSkillOverrideFn(ui, key);
  ui.cycleSkillProficiency = (key) => cycleSkillProficiencyFn(ui, key);
  ui.showAddSkillOverrideForm = () => showAddSkillOverrideFormFn(ui);
}
