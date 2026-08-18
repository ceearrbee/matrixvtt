/**
 * First-run onboarding tour. We don't drive the visual driver.js
 * walkthrough in jsdom - that needs computed layout - but we pin the
 * gating logic: completion only persists when the user reaches the
 * last step; an early close sets a session-scoped dismissal so the
 * tour doesn't re-pop within the same page session, but the user is
 * not permanently locked out by a single mis-click.
 *
 * Since the tutorial.js consolidation the tour is also the single
 * onboarding system: completion is user-scoped (two users sharing a
 * browser must not share it), legacy keys from both old systems count
 * as completed, and GM-only steps are filtered by GM state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('driver.js', () => ({
  driver: vi.fn(() => ({ drive: vi.fn(), destroy: vi.fn() })),
}));
vi.mock('driver.js/dist/driver.css', () => ({}));

import {
  buildTourSteps,
  hasCompletedTour, markTourCompleted, clearTourCompletion,
  maybeAutoStartTour, startOnboardingTour, restartOnboardingTour,
} from '../ui/onboarding-tour.js';
import { driver } from 'driver.js';
import { VTT_EVENTS } from '../utils/constants.js';

const TOUR_KEY = 'mxvtt:tour-completed';
const TUTORIAL_KEY = 'vtt-tutorial-completed';
const ALICE = '@alice:s';
const BOB = '@bob:s';

function makeUi({ userId = ALICE, isGM = false } = {}) {
  return {
    widgetManager: { userId },
    state: { isGM: () => isGM },
  };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.body.innerHTML = '';
  driver.mockClear();
});

describe('onboarding-tour completion flag (no userId fallback)', () => {
  it('hasCompletedTour returns false on a fresh install', () => {
    expect(hasCompletedTour()).toBe(false);
  });

  it('markTourCompleted with no userId persists the unscoped key', () => {
    markTourCompleted();
    expect(hasCompletedTour()).toBe(true);
    expect(localStorage.getItem(TOUR_KEY)).toBe('1');
  });

  it('clearTourCompletion removes both the completion flag and the session dismissal', () => {
    markTourCompleted();
    sessionStorage.setItem('mxvtt:tour-dismissed-session', '1');
    clearTourCompletion();
    expect(hasCompletedTour()).toBe(false);
    expect(sessionStorage.getItem('mxvtt:tour-dismissed-session')).toBeNull();
  });
});

describe('user-scoped completion', () => {
  it('markTourCompleted(userId) writes the scoped key, not the global one', () => {
    markTourCompleted(ALICE);
    expect(localStorage.getItem(`${TOUR_KEY}::${ALICE}`)).toBe('1');
    expect(localStorage.getItem(TOUR_KEY)).toBeNull();
  });

  it("alice's completion does not auto-complete bob", () => {
    markTourCompleted(ALICE);
    expect(hasCompletedTour(ALICE)).toBe(true);
    expect(hasCompletedTour(BOB)).toBe(false);
  });

  it('migrates the legacy unscoped tour key into the reading user scope', () => {
    localStorage.setItem(TOUR_KEY, '1');
    expect(hasCompletedTour(ALICE)).toBe(true);
    expect(localStorage.getItem(`${TOUR_KEY}::${ALICE}`)).toBe('1');
    expect(localStorage.getItem(TOUR_KEY)).toBeNull();
    expect(hasCompletedTour(BOB)).toBe(false);
  });

  it('treats the old scoped tutorial key as completed', () => {
    localStorage.setItem(`${TUTORIAL_KEY}::${ALICE}`, 'true');
    expect(hasCompletedTour(ALICE)).toBe(true);
    expect(hasCompletedTour(BOB)).toBe(false);
  });

  it('treats the old unscoped tutorial key as completed', () => {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    expect(hasCompletedTour(ALICE)).toBe(true);
  });

  it('clearTourCompletion(userId) removes tour and legacy tutorial keys in both scopes', () => {
    localStorage.setItem(TOUR_KEY, '1');
    localStorage.setItem(`${TOUR_KEY}::${ALICE}`, '1');
    localStorage.setItem(TUTORIAL_KEY, 'true');
    localStorage.setItem(`${TUTORIAL_KEY}::${ALICE}`, 'true');
    clearTourCompletion(ALICE);
    expect(hasCompletedTour(ALICE)).toBe(false);
  });
});

describe('buildTourSteps', () => {
  it('excludes GM-only steps for players', () => {
    const steps = buildTourSteps(false);
    expect(steps.some((s) => s.gmOnly)).toBe(false);
    expect(steps.some((s) => s.element === '#gm-controls-btn')).toBe(false);
  });

  it('includes GM-only steps for GMs', () => {
    const steps = buildTourSteps(true);
    expect(steps.some((s) => s.element === '#gm-controls-btn')).toBe(true);
    const blob = JSON.stringify(steps);
    expect(blob).toMatch(/add token/i);
  });

  it('covers the character sheet folded in from the old tutorial', () => {
    const blob = JSON.stringify(buildTourSteps(false));
    expect(blob).toMatch(/right-companion/);
    expect(blob).toMatch(/stat/i);
  });

  it('covers dice macros folded in from the old tutorial', () => {
    const blob = JSON.stringify(buildTourSteps(false));
    expect(blob).toMatch(/dice-bar/);
    expect(blob).toMatch(/macro/i);
  });

  it('mentions whispers in the chat step and wikilinks in the notes step', () => {
    const blob = JSON.stringify(buildTourSteps(false));
    expect(blob).toMatch(/whisper/i);
    expect(blob).toMatch(/wikilink/i);
  });
});

describe('maybeAutoStartTour', () => {
  it('returns immediately when the user has already completed', async () => {
    markTourCompleted();
    maybeAutoStartTour();
    await new Promise((r) => setTimeout(r, 30));
    expect(driver).not.toHaveBeenCalled();
  });

  it('returns immediately when the ui user completed under their scoped key', async () => {
    markTourCompleted(ALICE);
    maybeAutoStartTour({ ui: makeUi({ userId: ALICE }) });
    await new Promise((r) => setTimeout(r, 30));
    expect(driver).not.toHaveBeenCalled();
  });

  it('auto-starts for a different user on the same browser', async () => {
    document.body.innerHTML = '<div id="map-canvas"></div>';
    markTourCompleted(ALICE);
    maybeAutoStartTour({ ui: makeUi({ userId: BOB }) });
    await vi.waitFor(() => expect(driver).toHaveBeenCalled());
  });

  it('returns immediately when the user dismissed in this session', async () => {
    sessionStorage.setItem('mxvtt:tour-dismissed-session', '1');
    maybeAutoStartTour();
    await new Promise((r) => setTimeout(r, 30));
    expect(driver).not.toHaveBeenCalled();
  });

  it('drives a tour when no completion or dismissal is set', async () => {
    document.body.innerHTML = '<div id="map-canvas"></div>';
    maybeAutoStartTour();
    await vi.waitFor(() => expect(driver).toHaveBeenCalled());
  });
});

describe('startOnboardingTour', () => {
  it('skips steps whose target selector is not on screen', async () => {
    await startOnboardingTour();
    expect(driver).toHaveBeenCalledTimes(1);
    const arg = driver.mock.calls[0][0];
    // Only the trailing description-only step survives when no DOM is present.
    expect(arg.steps.length).toBe(1);
    expect(arg.steps[0].element).toBeUndefined();
  });

  it('does NOT mark completed when destroyed without reaching the last step (early X)', async () => {
    document.body.innerHTML = '<div id="map-canvas"></div>';
    await startOnboardingTour();
    const opts = driver.mock.calls[0][0];
    // Simulate the user clicking X early - onCloseClick fires, then onDestroyed.
    opts.onCloseClick?.();
    opts.onDestroyed();
    expect(hasCompletedTour()).toBe(false);
    expect(sessionStorage.getItem('mxvtt:tour-dismissed-session')).toBe('1');
  });

  it('marks completed when the last step is deselected (real completion)', async () => {
    document.body.innerHTML = '<div id="map-canvas"></div>';
    await startOnboardingTour();
    const opts = driver.mock.calls[0][0];
    const lastStep = opts.steps[opts.steps.length - 1];
    // Simulate driver.js calling onDeselected on the last step as the user
    // clicks "Got it" through to completion, then onDestroyed firing.
    lastStep.onDeselected?.();
    opts.onDestroyed();
    expect(hasCompletedTour()).toBe(true);
  });

  it('records completion under the ui userId', async () => {
    document.body.innerHTML = '<div id="map-canvas"></div>';
    await startOnboardingTour({ ui: makeUi({ userId: ALICE }) });
    const opts = driver.mock.calls[0][0];
    opts.steps[opts.steps.length - 1].onDeselected?.();
    opts.onDestroyed();
    expect(localStorage.getItem(`${TOUR_KEY}::${ALICE}`)).toBe('1');
    expect(hasCompletedTour(BOB)).toBe(false);
  });

  it('GM step appears for a GM ui when #gm-controls-btn is mounted', async () => {
    document.body.innerHTML = '<button id="gm-controls-btn"></button>';
    await startOnboardingTour({ ui: makeUi({ isGM: true }) });
    const arg = driver.mock.calls[0][0];
    expect(arg.steps.some((s) => s.element === '#gm-controls-btn')).toBe(true);
  });

  it('GM add-token step is filtered out for players even when its target exists', async () => {
    document.body.innerHTML = '<div id="map-canvas"></div>';
    await startOnboardingTour({ ui: makeUi({ isGM: false }) });
    const playerSteps = driver.mock.calls[0][0].steps.filter((s) => s.element === '#map-canvas');
    driver.mockClear();
    await startOnboardingTour({ ui: makeUi({ isGM: true }) });
    const gmSteps = driver.mock.calls[0][0].steps.filter((s) => s.element === '#map-canvas');
    expect(gmSteps.length).toBeGreaterThan(playerSteps.length);
  });

  it('Journal step appears when the journal index section is mounted', async () => {
    document.body.innerHTML = '<div data-section="journal"></div>';
    await startOnboardingTour();
    const arg = driver.mock.calls[0][0];
    expect(arg.steps.some((s) => s.element === '[data-section="journal"]')).toBe(true);
  });

  it('map-canvas step mentions right-click → Add Token guidance', async () => {
    document.body.innerHTML = '<div id="map-canvas"></div>';
    await startOnboardingTour();
    const arg = driver.mock.calls[0][0];
    const mapStep = arg.steps.find((s) => s.element === '#map-canvas');
    expect(mapStep).toBeTruthy();
    expect(mapStep.popover.description.toLowerCase()).toContain('right-click');
  });
});

describe('tour runtime lazy load failure', () => {
  it('surfaces an error toast and still continues to onAfterTour', async () => {
    document.body.innerHTML = '<div id="map-canvas"></div>';
    const onAfterTour = vi.fn();
    const messages = [];
    const onError = (e) => messages.push(e.detail?.message ?? '');
    window.addEventListener(VTT_EVENTS.ERROR, onError);
    await startOnboardingTour({
      ui: makeUi(),
      onAfterTour,
      _loadRuntime: () => Promise.reject(new Error('chunk load failed')),
    });
    window.removeEventListener(VTT_EVENTS.ERROR, onError);
    expect(driver).not.toHaveBeenCalled();
    expect(onAfterTour).toHaveBeenCalledTimes(1);
    expect(messages.length).toBe(1);
    expect(messages[0].toLowerCase()).toContain('tour');
  });
});

describe('restartOnboardingTour', () => {
  it('clears completion for the ui user and drives the tour', async () => {
    document.body.innerHTML = '<div id="map-canvas"></div>';
    markTourCompleted(ALICE);
    await restartOnboardingTour(makeUi({ userId: ALICE }));
    expect(hasCompletedTour(ALICE)).toBe(false);
    expect(driver).toHaveBeenCalledTimes(1);
  });

  it('works without a ui (falls back to unscoped keys)', async () => {
    markTourCompleted();
    await restartOnboardingTour();
    expect(hasCompletedTour()).toBe(false);
    expect(driver).toHaveBeenCalledTimes(1);
  });
});

describe('pointer-aware tour copy', () => {
  const text = (steps) => steps.map((s) => s.popover?.description ?? '').join('\n');

  it('coarse-pointer steps teach long-press, never right-click or Space-drag', async () => {
    const coarse = text(buildTourSteps(true, true));
    expect(coarse).not.toMatch(/right-click/i);
    expect(coarse).not.toMatch(/hold Space/i);
    expect(coarse).toMatch(/long-press/i);
  });

  it('fine-pointer copy keeps the mouse vocabulary', () => {
    const fine = text(buildTourSteps(true, false));
    expect(fine).toMatch(/right-click/i);
    expect(fine).toMatch(/hold Space/i);
  });

  it('no step teaches the removed preview popup', () => {
    // sheet-open.spec.js asserts cards select straight into the sidebar
    // sheet; the tour must not describe a popup that no longer exists.
    expect(text(buildTourSteps(true, false))).not.toMatch(/preview popup|read-only preview/i);
  });
});

describe('mobile pane routing', () => {
  it('every targeted step declares which mobile pane hosts it', () => {
    for (const step of buildTourSteps(true, false)) {
      if (!step.element) continue;
      expect(step.mobilePane, `${step.element} has no mobilePane`).toMatch(/^(chat|map|panel|journal)$/);
    }
  });

  it('withMobilePaneRouting switches the pane before each highlight', async () => {
    const { withMobilePaneRouting } = await import('../ui/onboarding-tour.js');
    const { mobilePaneSignal } = await import('../state/ui-signals.js');
    mobilePaneSignal.value = 'chat';

    const steps = withMobilePaneRouting(buildTourSteps(true, false), true);
    const journalStep = steps.find((s) => s.mobilePane === 'journal');
    expect(journalStep.onHighlightStarted).toBeTypeOf('function');
    journalStep.onHighlightStarted();
    expect(mobilePaneSignal.value).toBe('journal');

    // Desktop routing is a no-op passthrough.
    const desktop = withMobilePaneRouting(buildTourSteps(true, false), false);
    expect(desktop.find((s) => s.mobilePane === 'journal').onHighlightStarted).toBeUndefined();
    mobilePaneSignal.value = 'chat';
  });
});
