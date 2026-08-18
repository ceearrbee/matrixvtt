/**
 * placeMapLabels - combined map-label placement orchestrator.
 *
 * Wraps the pure `layoutTokenLabels` helper so pin labels and token
 * labels are deconflicted together (they live on separate Konva layers).
 * Each entry carries its own `apply(anchor)` so the caller maps the
 * world-space anchor back into whatever coord space that label lives in.
 */
import { describe, it, expect, vi } from 'vitest';
import { placeMapLabels } from '../map/place-map-labels.js';

const LABEL_H = 16;

function overlap(a, b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + LABEL_H <= b.y || b.y + LABEL_H <= a.y);
}

describe('placeMapLabels', () => {
  it('no-ops on empty / nullish input', () => {
    expect(() => placeMapLabels([])).not.toThrow();
    expect(() => placeMapLabels(null)).not.toThrow();
  });

  it('applies an anchor to every entry, using its labelWidth', () => {
    let got;
    placeMapLabels([
      { id: 'x', box: { x: 0, y: 50, w: 40, h: 40 }, labelWidth: 80, labelHeight: LABEL_H, apply: (a) => { got = a; } },
    ]);
    expect(got).toBeTruthy();
    expect(got.w).toBe(80);
    // Placed above the box top (y=50): anchor bottom sits above 50.
    expect(got.y + LABEL_H).toBeLessThanOrEqual(50);
  });

  it('stacks an overlapping pin + token label into non-overlapping rows', () => {
    const got = {};
    placeMapLabels([
      { id: 'tok', box: { x: 0, y: 100, w: 40, h: 40 }, labelWidth: 60, labelHeight: LABEL_H, apply: (a) => { got.tok = a; } },
      { id: 'pin', box: { x: 10, y: 100, w: 16, h: 16 }, labelWidth: 60, labelHeight: LABEL_H, apply: (a) => { got.pin = a; } },
    ]);
    expect(got.tok).toBeTruthy();
    expect(got.pin).toBeTruthy();
    expect(overlap(got.tok, got.pin)).toBe(false);
  });

  it('calls apply exactly once per entry', () => {
    const tok = vi.fn();
    const pin = vi.fn();
    placeMapLabels([
      { id: 'tok', box: { x: 0, y: 100, w: 40, h: 40 }, labelWidth: 60, labelHeight: LABEL_H, apply: tok },
      { id: 'pin', box: { x: 200, y: 100, w: 16, h: 16 }, labelWidth: 60, labelHeight: LABEL_H, apply: pin },
    ]);
    expect(tok).toHaveBeenCalledOnce();
    expect(pin).toHaveBeenCalledOnce();
  });
});
