/**
 * Parse a Universal VTT (UVTT) payload into MatrixVTT-shaped walls and lights.
 *
 * UVTT `line_of_sight` is an array of polylines. Each polyline is an array
 * of {x, y} points in grid units. We emit one wall per consecutive pair,
 * scaled by resolution.pixels_per_grid so coordinates match the rest of
 * the VTT's pixel-space.
 *
 * UVTT `portals` carry {bounds:[p1,p2], closed} - emitted as wall segments
 * with is_portal/is_open flags so the renderer can show them distinctly and
 * the GM can toggle them open/closed at runtime.
 *
 * UVTT `lights` carry {position, range, intensity?, color?} - emitted as
 * lights with pixel coordinates and pixel radius. The lights layer renders
 * them and the vision mask integrates them as bright zones.
 */

let seq = 0;

export function parseUVTT(uvtt) {
  const scale = uvtt?.resolution?.pixels_per_grid ?? 1;
  const polylines = uvtt?.line_of_sight ?? [];
  const portals = uvtt?.portals ?? [];
  const lights = uvtt?.lights ?? [];
  const walls = [];

  for (const line of polylines) {
    if (!Array.isArray(line) || line.length < 2) continue;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      walls.push({
        id: `uvtt-wall-${Date.now()}-${seq++}`,
        p1: { x: a.x * scale, y: a.y * scale },
        p2: { x: b.x * scale, y: b.y * scale },
        blocks_sight: true,
        blocks_movement: true,
      });
    }
  }

  for (const portal of portals) {
    if (!portal || !Array.isArray(portal.bounds) || portal.bounds.length < 2) continue;
    const [a, b] = portal.bounds;
    if (!a || !b) continue;
    const closed = portal.closed !== false; // default closed when ambiguous
    walls.push({
      id: `uvtt-portal-${Date.now()}-${seq++}`,
      p1: { x: a.x * scale, y: a.y * scale },
      p2: { x: b.x * scale, y: b.y * scale },
      is_portal: true,
      is_open: !closed,
      blocks_sight: closed,
      blocks_movement: closed,
    });
  }

  const outLights = [];
  for (const light of lights) {
    if (!light || !light.position || typeof light.range !== 'number') continue;
    const out = {
      id: `uvtt-light-${Date.now()}-${seq++}`,
      x: light.position.x * scale,
      y: light.position.y * scale,
      radius_px: light.range * scale,
    };
    if (typeof light.intensity === 'number') out.intensity = light.intensity;
    if (typeof light.color === 'string') out.color = light.color;
    outLights.push(out);
  }

  return { walls, lights: outLights };
}
