/**
 * ui-mode.js - phase hydration + auto-switch + prep setter for the
 * two-axis UI model (tablePhaseSignal × gmPrepActiveSignal).
 *
 * Lifecycle:
 *   - boot (user + room id known) → `hydratePhase(userId, roomId, isGM)`
 *     migrates any legacy single-mode value and sets the two signals.
 *   - boot (post-hydrate) → `bindPhaseToInitiative(userId, roomId)`
 *     wires an effect that watches `initiativeSignal.active` and
 *     auto-switches into Combat phase unless the user has manually
 *     overridden.
 *   - GM phase suggestion (SuggestedModeBanner) → `setPhase(userId, roomId, phase, { manual: true })`
 *   - GM Prep toggle → `gmPrepActiveSignal`
 */

import { effect } from '@preact/signals';
import { toast as sonnerToast } from 'sonner';
import {
  tablePhaseSignal,
  gmPrepActiveSignal,
  phaseManuallyOverriddenSignal,
  activeTabSignal,
  tabManuallyChosenSignal,
  openIconRailDrawerSignal,
  drawerManuallyChosenSignal,
  layoutModeSignal,
} from '../state/ui-signals.js';
import { initiativeSignal } from '../state/signals.js';
import { defaultTabFor, defaultDrawerFor } from './mode-registry.js';
import { readUserScoped, writeUserScoped } from '../utils/user-storage.js';
import {
  STORAGE_KEYS,
  STORAGE_KEY_PREFIXES,
  UI_MODES,
  ICON_RAIL_DRAWERS,
  LAYOUT_MODES,
  isLayoutMode,
} from '../utils/constants.js';

const DRAWER_VALUES = /** @type {Set<string>} */ (new Set(Object.values(ICON_RAIL_DRAWERS)));
/** @returns {v is 'scenes' | 'journal' | 'npcs' | 'items' | 'menu'} */
function isDrawerKey(v) { return typeof v === 'string' && DRAWER_VALUES.has(v); }
function drawerBaseKey(roomId) { return `${STORAGE_KEY_PREFIXES.ICON_RAIL_DRAWER}${roomId}`; }

function baseKey(roomId) {
  return `${STORAGE_KEYS.UI_MODE}:${roomId}`;
}

/**
 * Chrome layout mode (text | icon). Per-user but NOT room-scoped - layout
 * taste is a personal viewing choice that shouldn't change per campaign.
 * Defaults to text; invalid stored/requested values are ignored.
 */
export function hydrateLayoutMode(userId) {
  /** @type {'text' | 'icon'} */
  let mode = LAYOUT_MODES.TEXT;
  try {
    const raw = readUserScoped(STORAGE_KEYS.LAYOUT_MODE, userId);
    if (isLayoutMode(raw)) mode = raw;
  } catch { /* storage blocked - default */ }
  layoutModeSignal.value = mode;
}

export function setLayoutMode(userId, mode) {
  if (!isLayoutMode(mode)) return;
  layoutModeSignal.value = mode;
  if (!userId) return;
  try { writeUserScoped(STORAGE_KEYS.LAYOUT_MODE, userId, mode); } catch { /* ignore */ }
}

function scopedKey(roomId, userId) {
  return `${baseKey(roomId)}::${userId}`;
}

/**
 * Hydrate the table phase + prep from storage, migrating the legacy
 * single `uiMode` value: combat → phase combat; narrative → phase
 * narrative; gm-prep → phase narrative + (GM only) prep active. Sweeps
 * the legacy key afterwards so the migration runs once.
 */
export function hydratePhase(userId, roomId, isGM) {
  /** @type {'narrative' | 'combat'} */
  let phase = UI_MODES.NARRATIVE;
  let prep = false;
  try {
    const raw = readUserScoped(baseKey(roomId), userId);
    if (raw === UI_MODES.COMBAT) phase = UI_MODES.COMBAT;
    else if (raw === UI_MODES.GM_PREP) { phase = UI_MODES.NARRATIVE; prep = !!isGM; }
    else if (raw === UI_MODES.NARRATIVE) phase = UI_MODES.NARRATIVE;
  } catch { /* storage blocked - defaults */ }
  tablePhaseSignal.value = phase;
  gmPrepActiveSignal.value = prep;

  // One-shot sweep of the retired `vtt:calmer-view` toggle.
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k === 'vtt:calmer-view' || k?.startsWith('vtt:calmer-view::')) {
        localStorage.removeItem(k);
      }
    }
  } catch { /* ETP-blocked storage; ignore */ }

  // One-shot migration: drop the legacy single-mode key.
  try {
    const scoped = userId ? scopedKey(roomId, userId) : baseKey(roomId);
    localStorage.removeItem(scoped);
    localStorage.removeItem(baseKey(roomId));
  } catch { /* ignore */ }
}

export function setPhase(userId, roomId, phase, opts = {}) {
  if (phase !== UI_MODES.COMBAT && phase !== UI_MODES.NARRATIVE) return;
  const manual = opts.manual !== false;
  tablePhaseSignal.value = phase;
  if (manual) phaseManuallyOverriddenSignal.value = true;
  if (!userId || !roomId) return;
  try { writeUserScoped(baseKey(roomId), userId, phase); } catch { /* ignore */ }
}

let _phaseDispose = null;
let _priorPhase = null;

/**
 * Watch initiative: an active order puts the table in Combat (unless the
 * user manually overrode the phase this session); ending the order reverts
 * to the pre-combat phase. First synchronous firing is skipped.
 *
 * Shows an Undo toast on auto-switch so the user can revert without the
 * combat layout if they prefer.
 */
export function bindPhaseToInitiative(userId, roomId) {
  unbindPhaseFromInitiative();
  let lastActive = null;
  _phaseDispose = effect(() => {
    const active = !!(initiativeSignal.value && initiativeSignal.value.active);
    if (lastActive === null) { lastActive = active; return; }
    if (active === lastActive) return;
    lastActive = active;
    if (phaseManuallyOverriddenSignal.value) return;
    if (active) {
      if (tablePhaseSignal.value === UI_MODES.COMBAT) return; // already in combat
      _priorPhase = tablePhaseSignal.value;
      setPhase(userId, roomId, UI_MODES.COMBAT, { manual: false });
      sonnerToast('Combat started - switched to Combat phase.', {
        id: 'ui-phase-auto-combat',
        duration: 6000,
        action: {
          label: 'Undo',
          onClick: () => setPhase(userId, roomId, _priorPhase ?? UI_MODES.NARRATIVE, { manual: true }),
        },
      });
    } else {
      setPhase(userId, roomId, _priorPhase ?? UI_MODES.NARRATIVE, { manual: false });
      _priorPhase = null;
    }
  });
}

export function unbindPhaseFromInitiative() {
  if (typeof _phaseDispose === 'function') _phaseDispose();
  _phaseDispose = null;
  _priorPhase = null;
}


/**
 * Watch `tablePhaseSignal` and retarget `activeTabSignal` to the phase's
 * default tab whenever the user hasn't manually picked one this
 * session. The first synchronous firing is skipped so binding doesn't
 * stomp the hydrated tab.
 */
let _tabDispose = null;

export function bindAutoTabToMode(ui) {
  unbindAutoTabFromMode();
  let first = true;
  _tabDispose = effect(() => {
    const phase = tablePhaseSignal.value;
    const prep = gmPrepActiveSignal.value;
    if (first) { first = false; return; }
    if (tabManuallyChosenSignal.value) return;
    const isGM = typeof ui?.state?.isGM === 'function' ? ui.state.isGM() : false;
    const next = defaultTabFor(phase, isGM, prep);
    if (next && activeTabSignal.value !== next) {
      activeTabSignal.value = next;
      ui._currentTab = next;
    }
  });
}

export function unbindAutoTabFromMode() {
  if (typeof _tabDispose === 'function') _tabDispose();
  _tabDispose = null;
}

/**
 * Reset the session-scoped "user manually picked a tab" flag. Test-only
 * helper - production never wants to clear this mid-session.
 */
export function resetTabManuallyChosen() {
  tabManuallyChosenSignal.value = false;
}


/**
 * Watch `tablePhaseSignal` and retarget `openIconRailDrawerSignal` to the
 * phase's default drawer when the user hasn't manually picked. First
 * synchronous firing skipped so binding doesn't stomp the hydrated
 * drawer.
 */
let _drawerDispose = null;

export function bindAutoDrawerToMode(ui) {
  unbindAutoDrawerFromMode();
  let first = true;
  _drawerDispose = effect(() => {
    const phase = tablePhaseSignal.value;
    const prep = gmPrepActiveSignal.value;
    if (first) { first = false; return; }
    if (drawerManuallyChosenSignal.value) return;
    const isGM = typeof ui?.state?.isGM === 'function' ? ui.state.isGM() : false;
    const next = defaultDrawerFor(phase, isGM, prep);
    if (openIconRailDrawerSignal.value !== next) {
      openIconRailDrawerSignal.value = next;
    }
  });
}

export function unbindAutoDrawerFromMode() {
  if (typeof _drawerDispose === 'function') _drawerDispose();
  _drawerDispose = null;
}


/**
 * Hydrate `openIconRailDrawerSignal` from localStorage so the drawer
 * the user had open on their last visit re-opens on reload. Called
 * once `(userId, roomId)` are known, alongside `hydratePhase`.
 * Persisted `'null'` / unrecognised values resolve to a closed drawer.
 */
export function hydrateIconRailDrawer(userId, roomId) {
  try {
    const raw = readUserScoped(drawerBaseKey(roomId), userId);
    openIconRailDrawerSignal.value = isDrawerKey(raw) ? raw : null;
  } catch {
    openIconRailDrawerSignal.value = null;
  }
}

/**
 * Persist the open drawer (or `null` for closed) under
 * `vtt-icon-rail-drawer:${roomId}::${userId}`. Called by the IconRail
 * toggle and by mode-driven defaults that flip the signal.
 */
export function persistIconRailDrawer(userId, roomId, value) {
  if (!userId || !roomId) return;
  try {
    writeUserScoped(drawerBaseKey(roomId), userId, value == null ? '' : value);
  } catch {
    // localStorage blocked - signal is still the source of truth in-session.
  }
}
