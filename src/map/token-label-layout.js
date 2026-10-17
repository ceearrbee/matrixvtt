/**
 * token-label-layout.js - pure placement helper for token name labels.
 *
 * The map renderer feeds in each token's screen-space bounding box and
 * a function that measures the rendered label's width; the helper
 * returns a parallel array of label anchors `{ id, x, y, w }`,
 * positioned above each token and nudged upward in label-height
 * increments whenever two labels' bounding boxes would overlap.
 *
 * Greedy single-pass in input order. Beyond two consecutive collisions
 * we keep pushing - fine for the dozen-token tactical case the
 * screenshot showed. Not a SAT solver, by design.
 *
 * Inputs are pure data, so this module is independent of Konva and
 * directly unit-testable.
 *
 * @typedef {{ id: string, name: string, x: number, y: number, w: number, h: number }} TokenBox
 * @typedef {{ id: string, x: number, y: number, w: number }} LabelAnchor
 */

/**
 * @param {TokenBox[]} tokens
 * @param {{
 *   labelHeight?: number,
 *   labelWidthOf?: (token: TokenBox) => number,
 *   gap?: number,
 *   obstacles?: { id?: string, x: number, y: number, w: number, h: number }[],
 * } | { id?: string, x: number, y: number, w: number, h: number }[]} [optsOrObstacles]
 * @param {{ id?: string, x: number, y: number, w: number, h: number }[]} [extraObstacles]
 * @returns {LabelAnchor[]}
 */
export function layoutTokenLabels(tokens, optsOrObstacles = {}, extraObstacles = []) {
  let labelHeight = 12;
  let labelWidthOf = (t) => t.w;
  let gap = 2;
  let obstacles = [];

  if (Array.isArray(optsOrObstacles)) {
    obstacles = optsOrObstacles;
  } else if (optsOrObstacles && typeof optsOrObstacles === 'object') {
    if (optsOrObstacles.labelHeight !== undefined) labelHeight = optsOrObstacles.labelHeight;
    if (optsOrObstacles.labelWidthOf !== undefined) labelWidthOf = optsOrObstacles.labelWidthOf;
    if (optsOrObstacles.gap !== undefined) gap = optsOrObstacles.gap;
    if (Array.isArray(optsOrObstacles.obstacles)) obstacles = optsOrObstacles.obstacles;
  }
  if (Array.isArray(extraObstacles) && extraObstacles.length > 0) {
    obstacles = obstacles.concat(extraObstacles);
  }

  /** @type {LabelAnchor[]} */
  const placed = [];

  for (const t of tokens) {
    const w = labelWidthOf(t);
    const centreX = t.x + t.w / 2;
    const x = Math.round(centreX - w / 2);
    const yAbove = t.y - labelHeight - gap;

    const collidesWithObstacleOrToken = (box) => {
      for (const other of tokens) {
        if (other.id === t.id) continue;
        const tokenCollisionBox = {
          x: other.x,
          y: other.y,
          w: other.w,
          h: other.h + 12,
        };
        if (boxesOverlap(box, tokenCollisionBox)) return true;
      }
      for (const obs of obstacles) {
        if (obs.id === t.id) continue;
        if (boxesOverlap(box, obs)) return true;
      }
      return false;
    };

    const collidesWithPlaced = (box) => {
      return placed.some((p) => boxesOverlap(box, { x: p.x, y: p.y, w: p.w, h: labelHeight }));
    };

    let y = yAbove;
    const candidateAbove = { x, y: yAbove, w, h: labelHeight };

    if (collidesWithObstacleOrToken(candidateAbove)) {
      const yBelow = t.y + t.h + 12 + gap;
      const candidateBelow = { x, y: yBelow, w, h: labelHeight };
      if (!collidesWithObstacleOrToken(candidateBelow) && !collidesWithPlaced(candidateBelow)) {
        y = yBelow;
      } else {
        while (collidesWithPlaced({ x, y, w, h: labelHeight }) || collidesWithObstacleOrToken({ x, y, w, h: labelHeight })) {
          y -= labelHeight + gap;
        }
      }
    } else {
      while (collidesWithPlaced({ x, y, w, h: labelHeight })) {
        y -= labelHeight + gap;
      }
    }

    placed.push({ id: t.id, x, y, w });
  }

  return placed;
}

function boxesOverlap(a, b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}
