/**
 * The map strip renders its tools only once a map is loaded, so any
 * suite about those tools has to put one on the table first. Both
 * halves matter: `activeMapIdSignal` is what MapStrip subscribes to,
 * and `ui.state.map` is what the tools read.
 *
 * Suites that are about the empty state set the signals themselves.
 */
import { activeMapIdSignal, mapsSignal, tokensSignal } from '../../state/signals.js';

const TEST_MAP = Object.freeze({
  id: 'm-1', name: 'Crypt', width_cells: 20, height_cells: 20, cell_px: 40,
});

/** Publish TEST_MAP as the active map and return it for the ui stub's state. */
export function loadTestMap() {
  activeMapIdSignal.value = TEST_MAP.id;
  mapsSignal.value = new Map([[TEST_MAP.id, TEST_MAP]]);
  tokensSignal.value = new Map();
  return TEST_MAP;
}
