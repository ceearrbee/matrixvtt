/**
 * src/map/setup-layers.js - composes every Konva layer for the map.
 *
 * Bottom-to-top stacking: map-bg → grid → drawings → walls → templates
 * → env-tint → tokens → overlays → fog → pings.
 *
 * Sets `mr._tokensLayer`, `mr._disposeTokensLayer`, `mr._syncTokensLayer`,
 * `mr._pingsApi`, `mr._layerDisposers`, `mr._layerSyncers`, and
 * `mr._dragLayerSyncers` on the passed renderer.
 */

import { createMapBgLayer } from './layers/map-bg.js';
import { createGridLayer } from './layers/grid.js';
import { createDrawingsLayer } from './layers/drawings.js';
import { createWallsLayer } from './layers/walls.js';
import { createLightsLayer } from './layers/lights.js';
import { createTemplatesLayer } from './layers/templates.js';
import { createEnvTintLayer } from './layers/env-tint.js';
import { createTokensLayer } from './layers/tokens.js';
import { createOverlaysLayer } from './layers/overlays.js';
import { createFogLayer } from './layers/fog.js';
import { createPingsLayer } from './layers/pings.js';
import { createPinsLayer } from './layers/pins.js';
import { createSpeechBubblesLayer } from './layers/speech-bubbles.js';

export function setupLayers(mr) {
  const stage = mr.stage;
  if (!stage) return;
  const mapBg = createMapBgLayer(stage, mr);
  const grid = createGridLayer(stage, mr);
  const drawings = createDrawingsLayer(stage, mr);
  const walls = createWallsLayer(stage, mr);
  const lights = createLightsLayer(stage, mr);
  const templates = createTemplatesLayer(stage, mr);
  const envTint = createEnvTintLayer(stage, mr);
  const pins = createPinsLayer(stage, mr);
  const tokens = createTokensLayer(stage, mr);
  const overlays = createOverlaysLayer(stage, mr);
  const fog = createFogLayer(stage, mr);
  const pings = createPingsLayer(stage, mr);
  const speechBubbles = createSpeechBubblesLayer(stage, mr);
  mr._tokensLayer = tokens.layer;
  mr._disposeTokensLayer = tokens.dispose;
  mr._syncTokensLayer = tokens.sync;
  // Exposed so the tokens layer's label pass can deconflict token labels
  // against pin labels (separate layer) - see placeMapLabels.
  mr._pinsLayer = pins;
  mr._pingsApi = pings;
  mr._speechBubblesApi = speechBubbles;
  mr._layerDisposers = [
    mapBg.dispose, grid.dispose, drawings.dispose, walls.dispose,
    lights.dispose, templates.dispose, envTint.dispose, pins.dispose, fog.dispose,
  ];
  mr._layerSyncers = [
    mapBg.sync, grid.sync, drawings.sync, walls.sync, lights.sync,
    templates.sync, envTint.sync, pins.sync, overlays.sync, fog.sync,
  ];
  // Drag frames only repaint what a moving token can change: lights (token
  // light sources), overlays (AoE/measure previews anchored to tokens) and
  // fog (vision cones). See MapRenderer.renderDragFrame.
  mr._dragLayerSyncers = [lights.sync, overlays.sync, fog.sync];
}
