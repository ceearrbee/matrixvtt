/**
 * _save.js - thin writer delegate shared by the form + template
 * flows. Routes char vs NPC through the matching StateManager
 * facade method and wraps the write in a consistent VTTError toast.
 */

import { VTTError, ErrorType, showErrorNotification } from '../../utils/errorHandling.js';
import { EVENT_TYPES } from '../../utils/constants.js';

export async function saveEntity(ui, type, id, content) {
  const writer = type === EVENT_TYPES.NPC
    ? (i, v) => ui.state.updateNPC(i, v)
    : (i, v) => ui.state.updateCharacter(i, v);
  try {
    await writer(id, content);
  } catch (error) {
    showErrorNotification(new VTTError(ErrorType.STATE_WRITE, `Failed to save ${type}`, error));
  }
}
