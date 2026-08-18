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
 *   labelHeight: number,
 *   labelWidthOf: (token: TokenBox) => number,
 *   gap?: number,
 * }} opts
 * @returns {LabelAnchor[]}
 */
export function layoutTokenLabels(tokens, opts) {
  const { labelHeight, labelWidthOf, gap = 2 } = opts;
  /** @type {LabelAnchor[]} */
  const placed = [];

  for (const t of tokens) {
    const w = labelWidthOf(t);
    const centreX = t.x + t.w / 2;
    let x = Math.round(centreX - w / 2);
    let y = t.y - labelHeight - gap;

    while (placed.some((p) => boxesOverlap(
      { x, y, w, h: labelHeight },
      { x: p.x, y: p.y, w: p.w, h: labelHeight },
    ))) {
      y -= labelHeight + gap;
    }

    placed.push({ id: t.id, x, y, w });
  }

  return placed;
}

function boxesOverlap(a, b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}
