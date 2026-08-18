/**
 * vision-light.js - pure helpers for "is this point lit?" queries.
 *
 * The fog/vision Konva layer carves bright regions out of the darkness
 * mask using these helpers. Kept side-effect-free so it can be unit
 * tested without Konva.
 */

import { segmentBlockedByWalls } from '../utils/geometry.js';

export function lightsAsVisionOrigins(lights) {
  if (!lights) return [];
  const out = [];
  for (const l of lights.values ? lights.values() : lights) {
    if (!l || typeof l.x !== 'number' || typeof l.y !== 'number') continue;
    if (typeof l.radius_px !== 'number' || l.radius_px <= 0) continue;
    out.push({ x: l.x, y: l.y, bright: l.radius_px, dark: 0 });
  }
  return out;
}

export function cellLitByAnyLight(point, lights, walls) {
  if (!lights) return false;
  const iter = lights.values ? lights.values() : lights;
  for (const l of iter) {
    if (!l || typeof l.x !== 'number' || typeof l.y !== 'number') continue;
    if (typeof l.radius_px !== 'number' || l.radius_px <= 0) continue;
    const dx = point.x - l.x;
    const dy = point.y - l.y;
    if (dx * dx + dy * dy > l.radius_px * l.radius_px) continue;
    if (segmentBlockedByWalls({ x: l.x, y: l.y }, point, walls || [])) continue;
    return true;
  }
  return false;
}
