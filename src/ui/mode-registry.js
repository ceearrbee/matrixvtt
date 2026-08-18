/**
 * mode-registry.js - the two-axis UI model.
 *
 * Axis 1 (PHASE): the table's fiction state, narrative | combat. Combat is
 * an additive layer - it shows the initiative strip and auto-selects the
 * Combat tab in the right companion, but never hides the always-present
 * map+chat. Phase also drives log dominance.
 *
 * Axis 2 (PREP): a GM-only workspace overlay. When a GM has prep active,
 * the companion defaults to the Party roster tab; the intrinsic flags still
 * follow the phase.
 *
 * The right rail itself is the always-present `RightCompanion` (one tab set
 * for every phase/prep) - the phase/prep axes no longer SWAP the rail, they
 * only steer its default tab (`defaultTab`) and the mobile tab label
 * (`labelFor`). `defaultDrawer` likewise steers the left index.
 *
 * `fog.js` (map layer) deliberately does NOT import this module - it needs
 * only the phase for its alpha and importing here would pull the panels
 * into the canvas chunk. See the design doc.
 */
import { TABS, UI_MODES, ICON_RAIL_DRAWERS } from '../utils/constants.js';
import { RightCompanion } from './RightCompanion.jsx';
import { SheetIcon, CombatIcon, WrenchIcon } from './icons/index.jsx';

const PHASE = {
  [UI_MODES.NARRATIVE]: {
    rail: RightCompanion, label: 'Sheet', Icon: SheetIcon,
    initStrip: false, logNarrative: true,
    defaultTab: TABS.SHEET, defaultDrawer: ICON_RAIL_DRAWERS.JOURNAL,
  },
  [UI_MODES.COMBAT]: {
    rail: RightCompanion, label: 'Combat', Icon: CombatIcon,
    initStrip: true, logNarrative: false,
    defaultTab: TABS.COMBAT, defaultDrawer: null,
  },
};

// GM-only workspace overlay. Only the right-rail family (label/defaults) -
// intrinsic flags always come from the phase.
const PREP = {
  rail: RightCompanion, label: 'Prep', Icon: WrenchIcon,
  defaultTab: TABS.PARTY, defaultDrawer: ICON_RAIL_DRAWERS.SCENES,
};

Object.values(PHASE).forEach(Object.freeze);
Object.freeze(PHASE);
Object.freeze(PREP);

/** Phase entry, by phase only (no GM/prep influence). */
export function phaseEntry(phase) {
  return PHASE[phase] ?? PHASE[UI_MODES.NARRATIVE];
}

// Right-rail family: a GM with prep active gets the workspace; else phase.
function railEntry(phase, isGM, prepActive) {
  return isGM && prepActive ? PREP : phaseEntry(phase);
}

export function railFor(phase, isGM, prepActive) {
  return railEntry(phase, isGM, prepActive).rail;
}
export function labelFor(phase, isGM, prepActive) {
  const e = railEntry(phase, isGM, prepActive);
  return { label: e.label, Icon: e.Icon };
}
export function defaultTabFor(phase, isGM, prepActive) {
  return railEntry(phase, isGM, prepActive).defaultTab;
}
export function defaultDrawerFor(phase, isGM, prepActive) {
  return railEntry(phase, isGM, prepActive).defaultDrawer;
}

/** Intrinsic, phase-only. */
export function initStripIn(phase)  { return phaseEntry(phase).initStrip; }
export function isNarrativeLog(phase) { return phaseEntry(phase).logNarrative; }
