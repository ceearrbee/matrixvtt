/**
 * src/map/layers/pings.js - Konva ping layer.
 *
 * `createPingsLayer(stage, mr)` owns a
 * Konva.Layer and exposes an `addPing(x, y, color)` call. Each ping is
 * a Konva.Circle animated by Konva.Tween: radius grows from 0 to 40
 * while opacity fades to 0 over ~2s, then auto-destroys.
 *
 * MapRenderer's `addPing`
 * + `broadcastPing` forwards to this layer's `addPing`; there is no
 * separate RAF-driven ping loop or `mr._pings` array.
 */

import Konva from 'konva';
import { DEFAULT_PING_COLOR } from '../../utils/ui-constants.js';
import { prefersReducedMotion } from '../../utils/reduced-motion.js';

const PING_LIFETIME_MS = 2000;
const PING_MAX_RADIUS = 40;
const PING_STROKE_WIDTH = 3;

export function createPingsLayer(stage, mr) {
  const layer = new Konva.Layer({ listening: false });
  stage.add(layer);

  function addPing(x, y, color) {
    const circle = new Konva.Circle({
      x, y,
      radius: 0,
      stroke: color || DEFAULT_PING_COLOR,
      strokeWidth: PING_STROKE_WIDTH / (mr?.zoom || 1),
      opacity: 1,
      listening: false,
    });
    layer.add(circle);

    if (prefersReducedMotion()) {
      circle.radius(PING_MAX_RADIUS);
      circle.opacity(0.8);
      setTimeout(() => {
        circle.destroy();
        layer.batchDraw();
      }, PING_LIFETIME_MS);
      layer.batchDraw();
      return;
    }

    const tween = new Konva.Tween({
      node: circle,
      duration: PING_LIFETIME_MS / 1000,
      radius: PING_MAX_RADIUS,
      opacity: 0,
      onFinish: () => {
        tween.destroy();
        circle.destroy();
        layer.batchDraw();
      },
    });
    tween.play();
    layer.batchDraw();
  }

  function destroy() {
    layer.destroy();
  }

  return { layer, addPing, destroy };
}
