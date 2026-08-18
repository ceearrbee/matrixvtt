/**
 * Onboarding tour - the single guided introduction to MatrixVTT.
 *
 * Drives a spotlight tour over the main UI elements after the user's
 * first Blank Campaign setup, and on first entry into an existing room.
 * Completion is user-scoped (`mxvtt:tour-completed::<userId>`) so two
 * users sharing a browser don't share it; the legacy unscoped tour key
 * and both shapes of the removed step-modal tutorial's key
 * (`vtt-tutorial-completed`) still count as completed.
 *
 * Restart entry points: the global menu (Restart tour), the keyboard
 * help modal, Settings, and the GM import/export panel. All of them
 * call restartOnboardingTour(ui).
 *
 * Completion semantics:
 *   - Marked complete only when the user reaches (deselects) the last
 *     step. Closing the tour early via X does NOT mark complete -
 *     instead a sessionStorage flag suppresses re-prompt within the
 *     current page session so the user is not nagged but is also not
 *     permanently locked out by a single mis-click.
 *
 * Backed by `driver.js` (~5 kB, MIT), loaded on demand via
 * `tour-runtime.js` when a tour actually starts - most sessions never
 * start one, so neither the library nor its CSS belongs in the eager
 * set. GM-only steps are filtered by `ui.state.isGM()`; each remaining
 * step targets a DOM selector, and steps whose selector isn't on
 * screen are filtered at runtime so the tour doesn't hang on a
 * missing target.
 */

import { STORAGE_KEYS } from '../utils/constants.js';
import { emitVttError } from '../utils/errorHandling.js';
import { isCoarsePointer } from '../utils/pointer.js';
import { mobilePaneSignal } from '../state/ui-signals.js';
import { readUserScoped, writeUserScoped, removeUserScoped } from '../utils/user-storage.js';

const COMPLETED_KEY = STORAGE_KEYS.TOUR_COMPLETED;
const LEGACY_TUTORIAL_KEY = STORAGE_KEYS.TUTORIAL_COMPLETED;
const SESSION_DISMISSED_KEY = 'mxvtt:tour-dismissed-session';

const STEPS = [
  {
    mobilePane: 'map',
    element: '#map-canvas',
    popover: {
      title: 'Welcome to MatrixVTT',
      description:
        "This is your map. Drag tokens to move them, scroll to zoom, hold Space and drag to pan. Right-click anywhere on the map for a context menu; that's where you add tokens, drop pins, and reveal fog.",
      descriptionCoarse:
        "This is your map. Drag tokens to move them, pinch to zoom, drag with one finger to pan. Long-press anywhere on the map for a context menu; that's where you add tokens, drop pins, and reveal fog.",
    },
  },
  {
    mobilePane: 'map',
    element: '.draw-toolbar',
    popover: {
      title: 'Drawing tools',
      description:
        "Pick a tool here: line, rectangle, pencil, or measure. Then click and drag on the map. The pointer tool (V) is your default.",
    },
  },
  {
    mobilePane: 'map',
    element: '[data-tool-group="gm"]',
    gmOnly: true,
    popover: {
      title: 'Scene tools',
      description:
        'The Scene tab of the toolbar is your scene-building home: draw walls that block sight, place lights, drop area templates, add tokens, and reveal or hide fog. Right-clicking the map offers the same actions as a shortcut.',
      descriptionCoarse:
        'The Scene tab of the toolbar is your scene-building home: draw walls that block sight, place lights, drop area templates, add tokens, and reveal or hide fog. Long-pressing the map offers the same actions as a shortcut.',
    },
  },
  {
    mobilePane: 'map',
    element: '#zoom-in',
    popover: {
      title: 'Zoom controls',
      description: 'Quick zoom in/out. Mouse wheel and pinch-to-zoom also work.',
    },
  },
  {
    mobilePane: 'map',
    element: '#gm-controls-btn',
    gmOnly: true,
    popover: {
      title: 'GM tools',
      description:
        "GM-only. Open this header button for the session controls: switch maps, run the initiative tracker, manage fog of war, reveal handouts.",
    },
  },
  {
    mobilePane: 'map',
    element: '#map-canvas',
    gmOnly: true,
    popover: {
      title: 'Add tokens to the map',
      description:
        'Right-click an empty square and choose "Add Token Here" to drop a character, NPC, or marker. Right-click an existing token for quick actions.',
      descriptionCoarse:
        'Long-press an empty square and choose "Add Token Here" to drop a character, NPC, or marker. Long-press an existing token for quick actions.',
    },
  },
  {
    mobilePane: 'journal',
    element: '[data-section="journal"]',
    popover: {
      title: 'Journal & handouts',
      description:
        "The Journal section of the index holds handouts the GM has shared, session notes, and the campaign's reference pages. Wikilinks like [[char:lyra]] open a quick preview.",
    },
  },
  {
    mobilePane: 'panel',
    element: '.char-list, [data-character-card], [data-npc-card]',
    popover: {
      title: 'Click any card to open its sheet',
      description:
        "Click a character, NPC, or item card and it opens in the sidebar sheet, where you roll skill checks and saves directly. Tokens on the map work the same way: right-click → View Sheet, or double-click.",
      descriptionCoarse:
        "Tap a character, NPC, or item card and it opens in the sidebar sheet, where you roll skill checks and saves directly. Tokens on the map work the same way: long-press → View Sheet.",
    },
  },
  {
    mobilePane: 'panel',
    element: '.right-companion',
    popover: {
      title: 'Your companion panel',
      description:
        'Sheets, spells, skills, items, party, and combat live in this rail. Click a stat box on your sheet to roll a check straight into chat. During combat the Combat tab lights up and follows the turn order.',
    },
  },
  {
    mobilePane: 'chat',
    element: '.dice-bar',
    popover: {
      title: 'Dice & macros',
      description:
        'Roll any die combination with modifiers, and save your favorite rolls as macros for one-click access.',
    },
  },
  {
    mobilePane: 'chat',
    element: '.chronicle',
    popover: {
      title: 'Chat & dice',
      description:
        "The chronicle is the table's shared record: type to chat, or roll dice with `/r 1d20+5`. Whisper a player with `/w @user`. Rolls and damage events surface here too.",
    },
  },
  {
    popover: {
      title: 'Two more shortcuts',
      description:
        "<strong>/</strong> opens a fuzzy search across every named entity. <strong>?</strong> shows the full keyboard cheatsheet. Accessibility options (theme, reduced motion) live in Settings, and you can re-run this tour any time from the ☰ menu or Settings.",
    },
  },
];

/**
 * Pure step-list construction: GM-only steps are dropped for players.
 * The `gmOnly` marker is left on the step objects; driver.js ignores
 * unknown keys.
 */
export function buildTourSteps(isGM, coarse = isCoarsePointer()) {
  return STEPS
    .filter((s) => isGM || !s.gmOnly)
    .map((s) => {
      if (!s.popover) return s;
      const { descriptionCoarse, ...popover } = s.popover;
      if (coarse && descriptionCoarse) popover.description = descriptionCoarse;
      return { ...s, popover };
    });
}

/**
 * On phones the shell shows one pane at a time; a step whose target
 * lives in a hidden pane would be silently dropped. Route instead:
 * switch mobilePaneSignal to the step's pane just before highlight.
 * Desktop passes through untouched.
 */
export function withMobilePaneRouting(steps, isMobile) {
  if (!isMobile) return steps;
  return steps.map((s) => {
    if (!s.mobilePane) return s;
    return {
      ...s,
      onHighlightStarted: () => { mobilePaneSignal.value = s.mobilePane; },
    };
  });
}

function _filterAvailableSteps(steps) {
  return steps.filter((s) => !s.element || document.querySelector(s.element));
}

function _loadTourRuntime() {
  return import('./tour-runtime.js');
}

function _ctxFromUi(ui) {
  return {
    userId: ui?.widgetManager?.userId ?? ui?.state?.widgetManager?.userId ?? null,
    isGM: Boolean(ui?.state?.isGM?.()),
  };
}

export function hasCompletedTour(userId = null) {
  try {
    if (readUserScoped(COMPLETED_KEY, userId) === '1') return true;
    return readUserScoped(LEGACY_TUTORIAL_KEY, userId) === 'true';
  } catch { return false; }
}

export function markTourCompleted(userId = null) {
  try {
    if (userId) writeUserScoped(COMPLETED_KEY, userId, '1');
    else localStorage.setItem(COMPLETED_KEY, '1');
  } catch { /* private mode */ }
}

export function clearTourCompletion(userId = null) {
  try {
    removeUserScoped(COMPLETED_KEY, userId);
    removeUserScoped(LEGACY_TUTORIAL_KEY, userId);
  } catch { /* private mode */ }
  try { sessionStorage.removeItem(SESSION_DISMISSED_KEY); } catch { /* private mode */ }
}

function _markSessionDismissed() {
  try { sessionStorage.setItem(SESSION_DISMISSED_KEY, '1'); } catch { /* private mode */ }
}

function _wasSessionDismissed() {
  try { return sessionStorage.getItem(SESSION_DISMISSED_KEY) === '1'; }
  catch { return false; }
}

/**
 * Open the tour. Skips GM-only steps for players and steps whose
 * targets aren't currently mounted. Runs even when `hasCompletedTour()`
 * is true - callers gate that themselves (auto-run does, the manual
 * restart doesn't). Pass `opts.ui` so completion is recorded under the
 * current user and GM steps are included for GMs.
 *
 * Completion is recorded only when the user reaches the last step.
 * Closing early sets a session-scoped dismissal so the tour doesn't
 * re-pop within the current page session.
 */
export async function startOnboardingTour(opts = {}) {
  const { userId, isGM } = _ctxFromUi(opts.ui);
  const isMobile = typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 768px)').matches;
  const steps = withMobilePaneRouting(
    _filterAvailableSteps(buildTourSteps(isGM)), isMobile,
  );
  if (steps.length === 0) {
    opts.onAfterTour?.();
    return;
  }
  let driver;
  try {
    ({ driver } = await (opts._loadRuntime ?? _loadTourRuntime)());
  } catch (err) {
    emitVttError('The tour could not load. Check your connection and restart it from the menu.', err);
    opts.onAfterTour?.();
    return;
  }
  let reachedLastStep = false;
  const lastIndex = steps.length - 1;
  const instrumentedSteps = steps.map((s, i) => {
    if (i !== lastIndex) return s;
    return {
      ...s,
      onDeselected: () => { reachedLastStep = true; },
    };
  });
  const d = driver({
    showProgress: true,
    allowClose: true,
    overlayOpacity: 0.55,
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Got it',
    onCloseClick: () => {
      _markSessionDismissed();
      d.destroy();
    },
    onDestroyed: () => {
      if (reachedLastStep) markTourCompleted(userId);
      opts.onAfterTour?.();
    },
    steps: instrumentedSteps,
  });
  d.drive();
}

/**
 * Auto-run after Blank Campaign setup and on first entry into
 * an already-populated room. No-op when the user has already completed
 * the tour (or the old tutorial), or when they dismissed it earlier in
 * this page session.
 */
export function maybeAutoStartTour(opts = {}) {
  const { userId } = _ctxFromUi(opts.ui);
  if (hasCompletedTour(userId) || _wasSessionDismissed()) {
    opts.onAfterTour?.();
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(() => startOnboardingTour(opts)));
}

/** Manual restart: clear the current user's completion, then run. */
export function restartOnboardingTour(ui) {
  const { userId } = _ctxFromUi(ui);
  clearTourCompletion(userId);
  return startOnboardingTour({ ui });
}
