/**
 * Turn a map's generated layout into line-of-sight walls.
 *
 * An explicit GM action, never part of saving a background: walls are
 * real room state with a real cost, and a GM who only wants a pretty
 * floor should not silently acquire three hundred of them.
 *
 * Re-runnable. Walls this wrote are tagged `source: 'generated'` and
 * replaced on the next run, so rerolling a seed does not leave the
 * previous layout's walls behind. Anything the GM drew by hand is
 * untouched.
 */

import { resolveBackgroundSource } from '../../map/background-source.js';
import { generateTerrain } from '../../map/generators/index.js';
import { wallsFromTerrain } from '../../map/generators/walls-from-terrain.js';
import { VTTError, ErrorType } from '../../utils/errorHandling.js';
import { isGM } from '../reader.js';

const GENERATED_WALL_SOURCE = 'generated';

/**
 * @param {object} sm - StateManager
 * @param {string} mapId
 * @returns {Promise<number>} how many walls were written
 */
export async function applyGeneratedWalls(sm, mapId) {
  if (!isGM(sm)) throw new VTTError(ErrorType.PERMISSION, 'Only the GM can add walls.');

  const map = sm.maps.get(mapId);
  if (!map) return 0;

  const { fill } = resolveBackgroundSource(map);
  if (fill.kind !== 'generated') return 0;

  const grid = generateTerrain({
    generator: fill.generator,
    seed: fill.seed,
    width: map.width_cells,
    height: map.height_cells,
    params: fill.params,
  });
  if (!grid) return 0;

  const segments = wallsFromTerrain(grid, map.cell_px);
  const stale = [...sm.walls.values()]
    .filter((w) => w?.map_id === mapId && w?.source === GENERATED_WALL_SOURCE)
    .map((w) => w.id);

  sm.yjs.wallsMap.doc.transact(() => {
    for (const id of stale) sm.yjs.wallsMap.delete(id);
    segments.forEach((segment, index) => {
      const id = `wall-gen-${mapId}-${index}`;
      sm.yjs.wallsMap.set(id, { id, map_id: mapId, source: GENERATED_WALL_SOURCE, ...segment });
    });
  });

  return segments.length;
}
