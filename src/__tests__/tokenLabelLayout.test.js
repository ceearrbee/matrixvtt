/**
 * tokenLabelLayout - pure label placement helper.
 *
 * Input: an array of token boxes (x, y, w, h) in screen coords plus a
 * label height. Output: a parallel array of `{ x, y }` label anchors
 * positioned above each token; when two labels would overlap, the
 * later one is pushed up by one label-height. Greedy single-pass -
 * fast and good-enough for a handful of tokens.
 */
import { describe, it, expect } from 'vitest';
import { layoutTokenLabels } from '../map/token-label-layout.js';

const LABEL_H = 16;
const GAP = 2;

function token(x, y, w = 40, h = 40, name = 't', id = `${x},${y}`) {
  return { id, name, x, y, w, h };
}

function labelBox(label) {
  return { x: label.x, y: label.y, w: label.w, h: LABEL_H };
}

function overlap(a, b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

describe('layoutTokenLabels', () => {
  it('places each label directly above its token when no overlap', () => {
    const labels = layoutTokenLabels([token(0, 100), token(200, 100)], {
      labelHeight: LABEL_H, labelWidthOf: () => 60,
    });
    expect(labels[0].y).toBe(100 - LABEL_H - GAP);
    expect(labels[1].y).toBe(100 - LABEL_H - GAP);
  });

  it('pushes a colliding second label up by one label-height', () => {
    const tokens = [token(0, 100), token(20, 100)]; // overlap in X
    const labels = layoutTokenLabels(tokens, {
      labelHeight: LABEL_H, labelWidthOf: () => 60,
    });
    expect(labelBox(labels[0]).y + labelBox(labels[0]).h <= 100).toBe(true);
    expect(overlap(labelBox(labels[0]), labelBox(labels[1]))).toBe(false);
  });

  it('stacks three overlapping tokens into three non-overlapping label rows', () => {
    const tokens = [token(0, 100), token(10, 100), token(20, 100)];
    const labels = layoutTokenLabels(tokens, {
      labelHeight: LABEL_H, labelWidthOf: () => 60,
    });
    expect(overlap(labelBox(labels[0]), labelBox(labels[1]))).toBe(false);
    expect(overlap(labelBox(labels[0]), labelBox(labels[2]))).toBe(false);
    expect(overlap(labelBox(labels[1]), labelBox(labels[2]))).toBe(false);
  });

  it('returns an empty array for empty input', () => {
    expect(layoutTokenLabels([], { labelHeight: LABEL_H, labelWidthOf: () => 60 })).toEqual([]);
  });

  it('centres the label horizontally over the token', () => {
    const [label] = layoutTokenLabels([token(100, 100, 40, 40)], {
      labelHeight: LABEL_H, labelWidthOf: () => 60,
    });
    // Token centre is at x+20=120; label is 60 wide → label x = 120 - 30 = 90.
    expect(label.x).toBe(90);
  });
});
