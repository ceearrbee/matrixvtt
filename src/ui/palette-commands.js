/**
 * palette-commands.js - the verbs the command palette can run.
 *
 * Pure and DOM-free, in the same shape `global-menu-items.js` uses, so
 * the permission matrix is testable without a render context. Each
 * command delegates to a method already on the ui surface; nothing is
 * reimplemented here.
 *
 * This is the palette's answer to "where is X" for features that
 * otherwise need the Prep workspace, a right-click on the map, or a
 * tab inside a modal to reach.
 */

import { showInvitePlayerModal } from './InvitePlayerModal.jsx';
import { showKeyboardHelp } from './keyboard-help.js';
import { setFocusMode } from './ui-mode.js';
import { focusModeSignal } from '../state/ui-signals.js';
import { docsHref } from '../utils/docs-link.js';
import { destinationOf, travelPinsOn, runTravel } from '../map/actions/pin-travel.js';

const COMMAND_GROUPS = Object.freeze({
  PLAY: 'Play',
  SCENE: 'Scene',
  CAMPAIGN: 'Campaign',
  HELP: 'Help',
});

const TOKEN_GROUP = 'Selected token';

/**
 * Token verbs used to live only behind a right-click on the map, so
 * nothing on screen said they existed. They join the palette when a
 * token is selected and read as sentences about that token.
 */
function addTokenCommands(ui, add, token) {
  const mr = ui.mapRenderer;
  const name = token.name || 'token';
  add('token-facing', TOKEN_GROUP,
    token.facing != null ? `Clear ${name}'s facing` : `Set which way ${name} is facing`,
    () => (token.facing != null ? mr?._clearFacing?.(token.id) : mr?._startFacingMode?.(token.id)));
  add('token-duplicate', TOKEN_GROUP, `Duplicate ${name}`,
    () => ui.duplicateToken?.(token.id));
  const inOrder = ui.state?.initiative?.order?.some((e) => e.token_id === token.id);
  add('token-initiative', TOKEN_GROUP,
    inOrder ? `Remove ${name} from the initiative order` : `Add ${name} to the initiative order`,
    () => (inOrder ? ui.removeFromInitiative?.(token.id) : ui.addTokenToInitiative?.(token.id)));
  if (token.type === 'npc') {
    add('token-hp-visibility', TOKEN_GROUP, `Show or hide ${name}'s HP from players`,
      () => mr?.toggleTokenHPVisibility?.(token.id));
  }
}

/**
 * @param {any} ui
 * @param {{ isGM: boolean, combatActive: boolean, selectedToken?: any, selectionSize?: number }} context
 * @returns {{id: string, group: string, label: string, run: () => void}[]}
 */
export function buildPaletteCommands(ui, { isGM, combatActive, selectedToken = null, selectionSize = 0 }) {
  const commands = [];
  const add = (id, group, label, run) => commands.push({ id, group, label, run });

  if (isGM && selectedToken) addTokenCommands(ui, add, selectedToken);
  if (isGM && selectionSize > 1) {
    add('group-damage', TOKEN_GROUP, `Damage the ${selectionSize} selected tokens`,
      () => ui.mapRenderer?.showGroupDamageDialog?.('damage'));
    add('group-heal', TOKEN_GROUP, `Heal the ${selectionSize} selected tokens`,
      () => ui.mapRenderer?.showGroupDamageDialog?.('heal'));
    add('group-condition', TOKEN_GROUP, `Set a condition on the ${selectionSize} selected tokens`,
      () => ui.mapRenderer?.showGroupConditionDialog?.());
  }

  if (isGM) {
    if (combatActive) add('end-combat', COMMAND_GROUPS.PLAY, 'End combat', () => ui.endCombat?.());
    else add('roll-initiative', COMMAND_GROUPS.PLAY, 'Start combat and roll initiative', () => ui.rollInitiative?.());

    add('fog-toggle', COMMAND_GROUPS.SCENE, 'Turn fog of war on or off', () => ui.toggleFog?.());
    add('reveal-all', COMMAND_GROUPS.SCENE, 'Reveal the whole map', () => ui.revealAllFog?.());
    add('hide-all', COMMAND_GROUPS.SCENE, 'Hide the whole map', () => ui.hideAllFog?.());
    add('add-token', COMMAND_GROUPS.SCENE, 'Add a token to the map', () => ui.beginTokenPlacement?.());
    add('maps', COMMAND_GROUPS.SCENE, 'Open the maps manager', () => ui.openMapsPanel?.());
    add('bring-tokens', COMMAND_GROUPS.SCENE, 'Place tokens from another map on this one', () => ui.showBringTokens?.());
    // One per door on the map you are looking at: the trip is the
    // point of a travel pin, and right-click was its only path.
    for (const door of travelPinsOn(ui.state?.pins, ui.state?.activeMapId)) {
      const destination = destinationOf(ui.state.pins, door);
      add(`travel-${door.id}`, COMMAND_GROUPS.SCENE,
        `Move the party to ${destination.label || 'the other map'}`,
        () => runTravel(ui.mapRenderer, door));
    }
    add('invite', COMMAND_GROUPS.CAMPAIGN, 'Invite players', () => showInvitePlayerModal(ui));
  }

  add('focus-mode', COMMAND_GROUPS.PLAY,
    focusModeSignal.value ? 'Show the side rails again' : 'Focus mode: hide the side rails',
    () => setFocusMode(ui.widgetManager?.userId, ui.widgetManager?.roomId, !focusModeSignal.value));
  add('new-character', COMMAND_GROUPS.PLAY, 'Make a character', () => ui.showCharacterWizard?.());
  add('settings', COMMAND_GROUPS.CAMPAIGN, 'Open settings', () => ui.openSettings?.());
  add('shortcuts', COMMAND_GROUPS.HELP, 'Keyboard shortcuts', () => showKeyboardHelp());
  add('gm-quickstart', COMMAND_GROUPS.HELP, 'Read the GM quickstart',
    () => (ui.win ?? window).open(docsHref('guide/gm-quickstart'), '_blank', 'noopener'));

  return commands;
}
