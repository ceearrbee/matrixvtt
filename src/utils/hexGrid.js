/**
 * Axial-coordinate hex-grid helpers. `q` is the column-like axis, `r` is
 * the diagonal. `s = -q - r` reconstructs the third cube axis when needed.
 *
 * Reference: https://www.redblobgames.com/grids/hexagons/
 */

export function hexDistance(a, b) {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -dq - dr;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

const SQRT3 = Math.sqrt(3);

/**
 * @param {{ q: number, r: number }} h
 * @param {{ size: number, orientation?: 'pointy'|'flat' }} options
 */
export function hexToPixel(h, { size, orientation = 'pointy' }) {
  if (orientation === 'flat') {
    return {
      x: size * (3 / 2) * h.q,
      y: size * (SQRT3 / 2 * h.q + SQRT3 * h.r),
    };
  }
  return {
    x: size * (SQRT3 * h.q + (SQRT3 / 2) * h.r),
    y: size * (3 / 2) * h.r,
  };
}

/**
 * Inverse of hexToPixel. Snaps a pixel coordinate to the nearest integer
 * axial hex via cube-coordinate rounding. Translation-invariant: callers
 * comparing two converted points get a stable distance regardless of any
 * common map-origin offset.
 *
 * @param {{ x: number, y: number }} p
 * @param {{ size: number, orientation?: 'pointy'|'flat' }} options
 */
export function pixelToHex(p, { size, orientation = 'pointy' }) {
  let q, r;
  if (orientation === 'flat') {
    q = (2 / 3) * p.x / size;
    r = ((-1 / 3) * p.x + (SQRT3 / 3) * p.y) / size;
  } else {
    q = ((SQRT3 / 3) * p.x - (1 / 3) * p.y) / size;
    r = ((2 / 3) * p.y) / size;
  }
  return hexRound({ q, r });
}

export function hexRound({ q, r }) {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  // Normalize negative zero so `{ q: 0, r: 0 }` deep-equals across rounds.
  return { q: rq + 0, r: rr + 0 };
}

const POINTY_VERTEX_ANGLES = [30, 90, 150, 210, 270, 330].map((d) => (d * Math.PI) / 180);
const FLAT_VERTEX_ANGLES   = [0, 60, 120, 180, 240, 300].map((d) => (d * Math.PI) / 180);

/**
 * Snap a pixel to the nearest hex vertex. Picks the closest of the six
 * corners of the hex containing the click point - vertices shared with
 * neighbouring hexes resolve to the same physical point regardless of
 * which hex we identify as "the one" the click fell in.
 *
 * @param {{ x:number, y:number }} p
 * @param {{ size: number, orientation?: 'pointy'|'flat' }} options
 */
export function nearestHexVertex(p, { size, orientation = 'pointy' }) {
  const center = hexToPixel(pixelToHex(p, { size, orientation }), { size, orientation });
  const angles = orientation === 'flat' ? FLAT_VERTEX_ANGLES : POINTY_VERTEX_ANGLES;
  let best = null;
  let bestDistSq = Infinity;
  for (const ang of angles) {
    const v = { x: center.x + size * Math.cos(ang), y: center.y + size * Math.sin(ang) };
    const dSq = (v.x - p.x) ** 2 + (v.y - p.y) ** 2;
    if (dSq < bestDistSq) { bestDistSq = dSq; best = v; }
  }
  return best;
}

/**
 * Distance between two pixel points in *cells*, branching on grid type.
 * Square grids use Euclidean distance / cellPx (preserves the diagonal>1
 * convention the legacy measure tool used). Hex grids snap each end to
 * the nearest hex and return cube-distance.
 *
 * @param {{ x:number, y:number }} a
 * @param {{ x:number, y:number }} b
 * @param {{ gridType?: string, cellPx: number }} options
 */
export function measureDistanceCells(a, b, { gridType, cellPx }) {
  if (gridType === 'hex_pointy' || gridType === 'hex_flat') {
    const orientation = gridType === 'hex_flat' ? 'flat' : 'pointy';
    const ha = pixelToHex(a, { size: cellPx, orientation });
    const hb = pixelToHex(b, { size: cellPx, orientation });
    return hexDistance(ha, hb);
  }
  return Math.hypot(b.x - a.x, b.y - a.y) / cellPx;
}
