/**
 * state-effects.js - signal-driven side-effect registrations.
 *
 * Replaces the old `StateManager.notifyUpdate → globalBus →
 * window 'vtt:update' → handleUpdate` chain. Each effect reads a
 * domain signal; when that signal changes, the corresponding
 * controller-level side effect runs. A `primed` flag skips the
 * first auto-invocation so init-time signal reads don't replay
 * side effects before the app has rendered.
 *
 * Returns a `dispose()` callback that tears down every effect.
 */

import { effect } from '@preact/signals';
import { logger } from '../utils/logger.js';
import { esc } from '../utils/domHelpers.js';
import {
  settingsSignal, initiativeSignal, charactersSignal,
} from '../state/signals.js';

export function registerStateEffects(ui) {
  const disposers = [
    _settingsEffect(ui),
    _charactersEffect(ui),
    _initiativeEffect(ui),
  ];
  return () => disposers.forEach((d) => d());
}

function _settingsEffect(ui) {
  let primed = false;
  return effect(() => {
    settingsSignal.value;
    if (!primed) { primed = true; return; }
    try {
      ui._syncDisplayName();
      // Surface once per session: the loaded room references a ruleset
      // slug that no longer exists in the built-in registry.
      const slug = ui.state.settings?._system_missing;
      if (slug && !ui._missingRulesetToasted) {
        ui._missingRulesetToasted = true;
        ui._toast?.(
          `Ruleset "${slug}" is no longer built in. Open Settings to pick a new system or import a .vttruleset.json.`,
          'error',
        );
      }
    } catch (err) {
      logger.error('UI', 'settings effect failed', err);
    }
  });
}

function _charactersEffect(ui) {
  let primed = false;
  return effect(() => {
    charactersSignal.value;
    if (!primed) { primed = true; return; }
    try {
      ui._syncDisplayName();
    } catch (err) {
      logger.error('UI', 'characters effect failed', err);
    }
  });
}

function _initiativeEffect(ui) {
  let primed = false;
  // Track the last announced (active, round, current_index) so we don't
  // re-announce the same turn when the homeserver redelivers an
  // identical initiative event after a sync reconnect.
  let prev = { active: null, round: -1, idx: -1 };
  return effect(() => {
    initiativeSignal.value;
    if (!primed) { primed = true; return; }
    try {
      if (ui.state.loaded && !ui.state.refreshing) {
        const init = ui.state.initiative;
        const turnChanged = init.active !== prev.active
          || init.round !== prev.round
          || init.current_index !== prev.idx;
        if (init.active && init.order.length > 0) {
          if (turnChanged) {
            const cur = init.order[init.current_index];
            ui._log('⚔️', `Round ${init.round} - <b>${esc(cur?.name || '?')}</b>'s turn`);
            ui._announce(`${cur?.name || '?'}'s turn`);
            ui._startTurnTimer();
            if (cur?.token_id) ui.mapRenderer?.panToToken(cur.token_id);
          }
          ui.mapRenderer?.scheduleCombatFrame();
        } else if (!init.active && prev.active) {
          ui._stopTurnTimer();
          ui.mapRenderer?.cancelCombatFrame();
        }
        prev = { active: init.active, round: init.round, idx: init.current_index };
      }
      // No more auto-switch to the combat tab on turn transition. The
      // toast from `_announceMyTurn` already surfaces "it's your turn";
      // yanking the active tab away from whatever the user is reading
      // is the same side-effect-in-helper pattern we removed from
      // `ui._log`.
    } catch (err) {
      logger.error('UI', 'initiative effect failed', err);
    }
  });
}
