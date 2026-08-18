/**
 * place-map-labels.js - deconflict pin + token name labels together.
 *
 * Pins and tokens live on separate Konva layers, so neither layer's own
 * label pass can see the other's. This collects label "entries" from both,
 * runs the pure `layoutTokenLabels` placement helper over the combined set
 * (so every label stacks above its marker without overlapping any other),
 * then hands each entry its anchor via `apply` - the caller maps the
 * world-space anchor back into whatever coord space that label lives in
 * (token labels are group-local; pin labels are world).
 *
 * @typedef {{
 *   id: string,
 *   box: { x: number, y: number, w: number, h: number },
 *   labelWidth: number,
 *   labelHeight: number,
 *   apply: (anchor: { id: string, x: number, y: number, w: number }) => void,
 * }} LabelEntry
 *
 * @param {LabelEntry[]} entries
 */
import { layoutTokenLabels } from './token-label-layout.js';

export function placeMapLabels(entries) {
  if (!entries || entries.length === 0) return;
  const byId = new Map(entries.map((e) => [e.id, e]));
  // One stacking increment for the whole set - use the tallest label so
  // rows never overlap regardless of which layer they came from.
  const labelHeight = Math.max(...entries.map((e) => e.labelHeight || 12));
  const boxes = entries.map((e) => ({ id: e.id, name: '', x: e.box.x, y: e.box.y, w: e.box.w, h: e.box.h }));
  const anchors = layoutTokenLabels(boxes, {
    labelHeight,
    labelWidthOf: (t) => byId.get(t.id)?.labelWidth ?? t.w,
  });
  for (const a of anchors) byId.get(a.id)?.apply(a);
}
