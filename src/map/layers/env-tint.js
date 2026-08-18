/**
 * src/map/layers/env-tint.js - weather/time-of-day overlay tint.
 *
 * Cosmetic only. Reads `settingsSignal.environment`; skips when the
 * computed tint is transparent (`environmentTint` returns null or
 * 'rgba(0,0,0,0)').
 */
import { effect } from '@preact/signals';
import Konva from 'konva';
import { activeMapIdSignal, mapsSignal, settingsSignal } from '../../state/signals.js';
import { environmentTint } from '../../utils/environmentTint.js';

export function createEnvTintLayer(stage, _mr) {
  const layer = new Konva.Layer({ listening: false });
  stage.add(layer);

  // One pre-allocated Rect; mutate its size / fill / visibility per
  // sync rather than destroyChildren-ing each render. sync() runs on
  // every mr.render() during pan / drag / RAF, but the tint layer's
  // contents only actually change when the map dimensions or
  // environment string change.
  const rect = new Konva.Rect({ x: 0, y: 0, visible: false, listening: false });
  layer.add(rect);
  let lastSig = '';

  function sync() {
    const id = activeMapIdSignal.value;
    const map = id ? mapsSignal.value.get(id) : null;
    const settings = /** @type {any} */ (settingsSignal.value);
    // Per-map `map.env_tint` (a preset name like "dusk" or "cave") takes
    // precedence over the room-wide `settings.environment` legacy field.
    const env = map?.env_tint ?? settings?.environment;
    const tint = (map && env) ? environmentTint(env) : null;
    const sig = (!map || !tint || tint === 'rgba(0,0,0,0)')
      ? 'off'
      : `${map.width_cells}x${map.height_cells}x${map.cell_px}|${tint}`;
    if (sig === lastSig) return;
    lastSig = sig;
    if (sig === 'off') {
      rect.visible(false);
    } else {
      rect.visible(true);
      rect.size({
        width: map.width_cells * map.cell_px,
        height: map.height_cells * map.cell_px,
      });
      rect.fill(tint);
    }
    layer.batchDraw();
  }

  sync();
  const dispose = effect(() => {
    activeMapIdSignal.value;
    mapsSignal.value;
    settingsSignal.value;
    sync();
  });

  return { layer, dispose, sync };
}
