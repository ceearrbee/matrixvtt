/**
 * SuggestedModeBanner.jsx - non-blocking "GM suggests X" surface.
 *
 * Renders when `suggestedModeSignal` is non-null AND differs from the
 * local `tablePhaseSignal`. Two actions:
 *   - Follow → adopt the suggested mode (manual = false so the
 *     combat-auto-switch effect still wakes up), clear the suggestion.
 *   - Stay   → clear the suggestion without changing the local mode.
 *
 * The GM's own broadcast is echo-suppressed on the syncer side, so the
 * banner never appears for the user who clicked the mode selector.
 */

import { h } from 'preact';
import { tablePhaseSignal, suggestedModeSignal } from '../state/ui-signals.js';
import { setPhase } from './ui-mode.js';
import { UI_MODES } from '../utils/constants.js';

const MODE_LABELS = {
  [UI_MODES.COMBAT]: 'Combat',
  [UI_MODES.NARRATIVE]: 'Narrative',
  [UI_MODES.GM_PREP]: 'GM Prep',
};

export function SuggestedModeBanner({ ui }) {
  const raw = suggestedModeSignal.value;
  // Treat a stale gm-prep suggestion as narrative (gm-prep is no longer a table phase).
  const suggested = raw === UI_MODES.GM_PREP ? UI_MODES.NARRATIVE : raw;
  const current = tablePhaseSignal.value;
  if (!suggested || suggested === current) return null;

  const userId = ui?.widgetManager?.userId ?? null;
  const roomId = ui?.widgetManager?.roomId ?? null;
  const label = MODE_LABELS[suggested] ?? suggested;

  const onFollow = () => {
    setPhase(userId, roomId, suggested, { manual: true });
    suggestedModeSignal.value = null;
  };
  const onStay = () => { suggestedModeSignal.value = null; };

  return h('div', {
    class: 'suggested-mode-banner',
    role: 'status',
    'aria-live': 'polite',
  }, [
    h('span', { class: 'suggested-mode-banner__text' }, `GM suggests ${label} mode`),
    h('button', {
      type: 'button',
      class: 'suggested-mode-banner__btn suggested-mode-banner__btn--follow',
      'data-action': 'follow',
      onClick: onFollow,
    }, 'Follow'),
    h('button', {
      type: 'button',
      class: 'suggested-mode-banner__btn suggested-mode-banner__btn--stay',
      'data-action': 'stay',
      onClick: onStay,
    }, 'Stay'),
  ]);
}
