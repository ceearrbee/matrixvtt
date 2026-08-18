/**
 * SuggestedModeBanner - non-blocking GM-suggestion surface.
 *
 * Renders when `suggestedModeSignal` is non-null and differs from the
 * local `tablePhaseSignal`. "Follow" applies the suggested phase (and
 * clears the suggestion); "Stay" clears the suggestion only.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, h } from 'preact';
import { SuggestedModeBanner } from '../ui/SuggestedModeBanner.jsx';
import { tablePhaseSignal, suggestedModeSignal } from '../state/ui-signals.js';
import { UI_MODES } from '../utils/constants.js';

function makeUi() {
  return { widgetManager: { userId: '@player:m', roomId: '!r:m' } };
}

describe('SuggestedModeBanner', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    suggestedModeSignal.value = null;
  });
  afterEach(() => { render(null, host); host.remove(); });

  it('renders nothing when there is no suggestion', () => {
    render(h(SuggestedModeBanner, { ui: makeUi() }), host);
    expect(host.querySelector('.suggested-mode-banner')).toBeNull();
  });

  it('renders nothing when the suggestion equals the current phase', () => {
    suggestedModeSignal.value = UI_MODES.NARRATIVE;
    render(h(SuggestedModeBanner, { ui: makeUi() }), host);
    expect(host.querySelector('.suggested-mode-banner')).toBeNull();
  });

  it('shows the suggestion when it differs from the current phase', () => {
    suggestedModeSignal.value = UI_MODES.COMBAT;
    render(h(SuggestedModeBanner, { ui: makeUi() }), host);
    const banner = host.querySelector('.suggested-mode-banner');
    expect(banner).not.toBeNull();
    expect(banner.textContent.toLowerCase()).toContain('combat');
  });

  it('Follow applies the suggested phase and clears the suggestion', () => {
    // Suggestion differs from current Narrative default, so the banner mounts.
    suggestedModeSignal.value = UI_MODES.COMBAT;
    render(h(SuggestedModeBanner, { ui: makeUi() }), host);
    /** @type {HTMLButtonElement|null} */
    const follow = host.querySelector('[data-action="follow"]');
    follow.click();
    expect(tablePhaseSignal.value).toBe(UI_MODES.COMBAT);
    expect(suggestedModeSignal.value).toBeNull();
  });

  it('Stay clears the suggestion but leaves the phase alone', () => {
    // A stale gm-prep suggestion: treated as narrative, so no banner
    // (current is already narrative). Test real Stay with combat suggestion.
    suggestedModeSignal.value = UI_MODES.COMBAT;
    render(h(SuggestedModeBanner, { ui: makeUi() }), host);
    /** @type {HTMLButtonElement|null} */
    const stay = host.querySelector('[data-action="stay"]');
    stay.click();
    expect(tablePhaseSignal.value).toBe(UI_MODES.NARRATIVE);
    expect(suggestedModeSignal.value).toBeNull();
  });
});
