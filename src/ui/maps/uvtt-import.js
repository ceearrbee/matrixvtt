/**
 * Importing a Universal VTT file as a whole map.
 *
 * The file carries the battlemap image, the grid it was drawn on and
 * the walls together, so one drop should produce a playable map. The
 * map is created before the walls land, because walls are anchored to
 * whichever map is active.
 */

import { uploadMapImage } from './upload-map-image.js';

/** UVTT embeds the image as bare base64, no data-URI prefix. */
function base64ToBlob(base64, type = 'image/png') {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

function countsPhrase(walls, lights) {
  const parts = [];
  if (walls) parts.push(`${walls} wall segment${walls === 1 ? '' : 's'}`);
  if (lights) parts.push(`${lights} light${lights === 1 ? '' : 's'}`);
  return parts.join(' and ');
}

export async function importUvtt(ui, file) {
  const json = JSON.parse(await file.text());
  const { parseUVTT } = await import('../../utils/uvttImport.js');
  const { walls, lights = [], image, grid } = parseUVTT(json);

  if (walls.length === 0 && lights.length === 0 && !image) {
    ui._toast?.('That file carried no map image, walls or lights', 'info');
    return null;
  }

  let mapId = null;
  if (grid && ui.state?.isGM?.()) {
    let imageUrl = null;
    if (image) {
      imageUrl = await uploadMapImage(ui, base64ToBlob(image));
      // A declined or failed upload still leaves a usable map: the GM
      // can paste an image URL, and the walls are the slow part.
      if (!imageUrl) ui._toast?.('Map created without its image. Add one from the map form.', 'info');
    }
    mapId = await ui.state.createMap?.({
      name: file.name?.replace(/\.[^.]+$/, '') || 'Imported map',
      width_cells: grid.widthCells,
      height_cells: grid.heightCells,
      cell_px: grid.cellPx,
      image_url: imageUrl,
    });
    if (grid.clamped) {
      ui._toast?.(
        `Grid adjusted to ${grid.widthCells} by ${grid.heightCells} cells at ${grid.cellPx} px to fit the map limits.`,
        'info',
      );
    }
  }

  const suffix = () => Math.random().toString(36).slice(2, 8);
  for (const w of walls) await ui.state.addWall?.({ ...w, id: `${w.id}-${suffix()}` });
  for (const l of lights) await ui.state.addLight?.({ ...l, id: `${l.id}-${suffix()}` });

  const counts = countsPhrase(walls.length, lights.length);
  const what = mapId ? (counts ? `map with ${counts}` : 'map') : counts;
  ui._toast?.(`Imported ${what} from UVTT`, 'success');
  return mapId;
}
