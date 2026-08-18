
import { VTTError, ErrorType, showErrorNotification } from '../../utils/errorHandling.js';

export async function saveInitiative(ui) {
  try {
    // Most callers mutate ui.state.initiative (and its .order array) in
    // place - .splice, .push, indexed assignment - before invoking us.
    // looks like a write on the wire, but the bridge mirrors it back
    // via the identical reference and Preact's signal de-dupes equal
    // references - subscribers never fire, the UI doesn't re-render
    // the change. Shallow-clone here so each save lands a fresh
    // reference, fanning out to every component that reads it.
    const cur = ui.state.initiative;
    const next = { ...cur, order: Array.isArray(cur.order) ? [...cur.order] : [] };
    await ui.state.updateInitiative(next);
  } catch (error) {
    showErrorNotification(new VTTError(ErrorType.STATE_WRITE, 'Failed to save initiative', error));
  }
}
