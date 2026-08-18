/**
 * fog-ops.js - fog-of-war singleton writes. Toggle / reveal-all /
 * hide-all share the same GM guard + optimistic-write-with-rollback
 * shape: snapshot prev fog → writer call → restore prev on failure.
 */

import { VTTError, ErrorType, showErrorNotification } from '../../utils/errorHandling.js';
import { confirmAsync } from '../confirm-dialogs.jsx';
import { EVENT_TYPES } from '../../utils/constants.js';
import { FOG_MODES } from '../../utils/ui-constants.js';
import { denyIfNotGM } from './permission-guard.js';

async function _writeFog(ui, nextFog, errorMsg) {
  const prevFog = ui.state.fog;
  ui.state.cancelDebouncedSend(EVENT_TYPES.FOG, '');
  try {
    await ui.state.updateFog(nextFog);
  } catch (error) {
    ui.state.fog = prevFog;
    showErrorNotification(new VTTError(ErrorType.STATE_WRITE, errorMsg, error));
  }
}

export async function toggleFog(ui) {
  if (denyIfNotGM(ui, 'only GM can toggle fog', 'Fog of war is managed by GMs only. Ask a GM to toggle it.')) return;
  const prev = ui.state.fog;
  const newMode = prev.mode === FOG_MODES.HIDDEN ? FOG_MODES.VISIBLE : FOG_MODES.HIDDEN;
  await _writeFog(ui, { ...prev, mode: newMode }, 'Failed to toggle fog of war');
  ui._toast?.(`Fog of war: ${newMode === FOG_MODES.HIDDEN ? 'on' : 'off'}`, 'success');
}

export async function revealAllFog(ui) {
  if (denyIfNotGM(ui, 'only GM can reveal fog', 'Revealing fog is a GM action. Ask a GM in this room.')) return;
  if (!ui.state.map) return;
  return confirmAsync(
    'Reveal the entire map to every player? This shows all cells at once and is hard to undo without a re-fog.',
    async () => {
      const revealed = [];
      for (let col = 0; col < ui.state.map.width_cells; col++) {
        for (let row = 0; row < ui.state.map.height_cells; row++) {
          revealed.push(`${col},${row}`);
        }
      }
      await _writeFog(ui, { mode: FOG_MODES.HIDDEN, revealed }, 'Failed to reveal fog of war');
      ui._toast?.('Fog cleared - entire map is visible to players.', 'success');
    },
    { title: 'Reveal Entire Map', confirmText: 'Reveal All', confirmClass: 'btn-primary' }
  );
}

export async function hideAllFog(ui) {
  if (denyIfNotGM(ui, 'only GM can hide fog', 'Hiding fog is a GM action. Ask a GM in this room.')) return;
  return confirmAsync(
    'Hide the entire map from players? This re-fogs every cell.',
    async () => {
      await _writeFog(ui, { mode: FOG_MODES.HIDDEN, revealed: [] }, 'Failed to hide fog of war');
      ui._toast?.('Fog applied - map is hidden from players.', 'success');
    },
    { title: 'Hide Entire Map', confirmText: 'Hide All', confirmClass: 'btn-primary' }
  );
}
