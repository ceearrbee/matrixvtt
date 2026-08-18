/**
 * state-init.js - fresh-StateManager initial values for every signal.
 *
 * Module-level signals persist across test runs and across session
 * resets; a new StateManager must reset them rather than inherit
 * whatever the last run left behind. `resetSignals()` centralises
 * the initial-value literals so the constructor stays readable.
 */

import { DEFAULTS } from '../utils/constants.js';
import {
  tokensSignal, charactersSignal, npcsSignal, itemsSignal, spellsSignal,
  handoutsSignal, tablesSignal, pinsSignal, templatesSignal, wallsSignal,
  lightsSignal, mapsSignal, pagesSignal, fogSignal, initiativeSignal, settingsSignal,
  activeMapIdSignal, drawingsSignal, roomMembersSignal, reactionsSignal,
} from './signals.js';
import { replyContextSignal } from './ui-signals.js';

export function resetSignals() {
  tokensSignal.value = new Map();
  charactersSignal.value = new Map();
  npcsSignal.value = new Map();
  itemsSignal.value = new Map();
  spellsSignal.value = new Map();
  handoutsSignal.value = new Map();
  tablesSignal.value = new Map();
  pinsSignal.value = new Map();
  templatesSignal.value = new Map();
  wallsSignal.value = new Map();
  lightsSignal.value = new Map();
  mapsSignal.value = new Map();
  pagesSignal.value = new Map();
  settingsSignal.value = { gm_user_ids: [], name: 'MatrixVTT Session', system: 'generic', grid_px: DEFAULTS.GRID_PX };
  activeMapIdSignal.value = null;
  fogSignal.value = new Map();
  initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
  drawingsSignal.value = [];
  roomMembersSignal.value = [];
  reactionsSignal.value = new Map();
  replyContextSignal.value = null;
}
