/**
 * _public-surface.js - explicit allow-list of the ui controller's
 * public API. `_public-surface.test.js` fails if the constructed
 * `ui` deviates from it, so every new method must land here.
 *
 * Categories are cosmetic; what matters to the test is that the
 * union of all arrays matches the constructed ui's public keys
 * exactly.
 */

/** Surface called by Preact components + feature modules at runtime. */
export const PUBLIC_SURFACE = {
  // Non-method fields. `diceRoller` and `destroy` are attached only by
  // the full `createUI` lifecycle (not `createMinimalUI`, which the
  // surface test uses to avoid leaking window listeners), so they are
  // kept in `LIFECYCLE_ONLY` below.
  fields: [
    'state',
    'widgetManager',
    'chat',
    'mapRenderer',
    'activityLog',
  ],

  render: [
    'render',
    'setupResizeHandlers',
    'updateMapPanel',
    'restoreTheme',
    'toggleTheme',
    'dismissMapHelp',
    'shouldShowMapHelp',
  ],

  // Map controls (extracted to map-controls-wiring).
  map: [
    'zoomIn', 'zoomOut', 'setDrawTool', 'setDrawColor', 'setDrawWidth',
    'pingLocation', 'clearDrawings', 'undoDrawing', 'redoDrawing',
    'setSpeakAs', 'beginTokenPlacement', 'revealFogArea', 'hideFogArea',
  ],

  // Event handlers (event-wiring).
  events: [
    'handleDiceRollResult', 'handleDamage', 'handleHeal',
    'handleViewSheet', 'updateDiceResult',
  ],

  // Modals + panels (modal-wiring).
  modals: [
    'openSettings', 'openMapsPanel',
    'showEntityForm', 'showEditCharacterForm', 'showAddNPCForm',
    'showTokenForm', 'showCharacterWizard',
    'showSpellForm', 'showItemForm', 'showEditItemForm',
    'showHandoutForm', 'showHandoutModal', 'showTableForm',
    'showFirstTimeSetup', 'showPlayerWelcome',
    'duplicateToken',
    'showCharacterPreview', 'showNPCPreview', 'showItemPreview', 'showSpellPreview', 'previewToken',
    'castSpell', 'consumeItem',
  ],

  // Import / export (io-wiring).
  io: [
    'exportState', 'characterToMarkdown', 'npcToMarkdown',
    'exportCharactersMarkdown', 'exportNPCsMarkdown',
    'showImportMarkdownDialog', 'importMarkdown',
    'importCharacterFromMarkdown', 'importNPCFromMarkdown',
    'exportRuleset', 'importRuleset', 'importUvttFile',
    'importCampaign',
    'downloadMarkdown',
  ],

  // Navigation + selection.
  nav: [
    'selectToken', 'switchTab',
    'selectCharacterById', 'selectNPCById', 'clearSelectedNPC',
  ],

  // Data operations (data-wiring).
  data: [
    'createCharacter', 'updateCharacter', 'patchEntity', 'deleteCharacter',
    'claimCharacter', 'unclaimCharacter', 'assignNPCController', 'releaseNPCController',
    'saveCharacterAsTemplate', 'deleteCharacterTemplate', 'applyCharacterTemplate',
    'createNPC', 'updateNPC', 'deleteNPC', 'placeSheetOnMap', 'createNPCFromTemplate',
    'createToken', 'updateToken',
    'createItem', 'updateItem', 'deleteItem', 'toggleEquipItem',
    'createSpell', 'updateSpell', 'deleteSpell',
    'toggleSpellPrepared', 'toggleSpellSlotPip',
    'rollTable', 'deleteTable', 'toggleHandoutVisibility', 'deleteHandout',
    'showPageForm', 'showPageView', 'closePageView', 'togglePageVisibility', 'deletePage',
    'openDoc', 'closeDoc', 'closeAllDocs', 'bringDocToFront',
    'enterScene', 'leaveScene',
    'deleteSkillOverride', 'cycleSkillProficiency', 'showAddSkillOverrideForm',
  ],

  // Combat + dice (combat-wiring).
  combat: [
    'nextTurn', 'prevTurn', 'setTurn', 'endCombat',
    'rollInitiative', 'rollMyInitiative', 'rollInitiativeDie',
    'addTokenToInitiative', 'removeFromInitiative', 'reorderInitiative', 'setInitiativeRoll',
    'toggleCombatAction',
    'handleDiceRoll', 'rollAttributeCheck', 'rollSkillCheck', 'rollNPCAction',
    'rollDice', 'rollWithAdvantage', 'rollWithDisadvantage',
    'saveCurrentFormula', 'rollMacro',
    'toggleSecretRoll',
  ],

  // GM operations (gm-wiring).
  gm: [
    'applyLongRest', 'adjustXP',
    'toggleFog', 'revealAllFog', 'hideAllFog',
    'healAll', 'clearAllConditions',
    'setHP', 'adjustHP', 'adjustTokenHP',
    'deleteSession', 'submitMapForm',
    'kickUser', 'banUser',
  ],

  // Misc public utilities.
  utils: [
    'saveInitialState', 'sendChatMessage', 'toggleDebugMode',
  ],
};

/**
 * Underscore-prefixed internal surface. Kept separate so a growing
 * internal API doesn't pretend to be stable, while the public surface
 * above stays small and intentional.
 */
export const INTERNAL_SURFACE = [
  '_announce', '_toast', '_log',
  '_findTokenForSender',
  '_debugMode', '_copyDebugToken', '_clearDebugStorage', '_hardReload',
  '_updateSyncBanner', '_refreshApiStatus',
  '_getSystemAttrs', '_syncDisplayName',
  '_calcModifier', '_deriveCharacterSaves',
  '_collectSpellSlots', '_collectAttributeValues',
  '_renderTemplatePicker', '_setupTemplatePickerHandlers',
  '_tombstoneOldEntities',
  '_selectTokenAndSwitchTab',
  '_showAttackModal', '_showAttackFromTargetModal', '_resolveAttack',
  '_isMyCombatTurn', '_startTurnTimer', '_stopTurnTimer',
  '_fireRoll', '_fireAdvantageRoll', '_fireDisadvantageRoll', '_fireFormulaRoll',
  '_getRollFormula', '_expandFormula',
  '_createNPCFromTemplate',
  '_logFilter', '_logSearch', '_logLoadingHistory', '_seenLogEventIds',
  '_turnStartMs', '_turnTimerInterval',
  '_lastSetDisplayName', '_syncDisplayNameTimer',
  '_forceWizard', '_welcomeShown',
];

/**
 * Attached only by the full `createUI` lifecycle (listeners, dice
 * roller, destroy hook). The lint test uses `createMinimalUI` so these
 * don't appear there.
 */
export const LIFECYCLE_ONLY = ['diceRoller', 'destroy'];

export function allKnownKeys() {
  return new Set([
    ...Object.values(PUBLIC_SURFACE).flat(),
    ...INTERNAL_SURFACE,
  ]);
}
