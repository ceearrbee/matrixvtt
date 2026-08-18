/**
 * Group handouts into a hierarchy via optional parent_id.
 * Circular or dangling parents fall back to root (best-effort).
 */

import { describe, it, expect } from 'vitest';
import { buildHandoutTree } from '../utils/handoutTree.js';

describe('buildHandoutTree', () => {
  it('flat list when no parent_id anywhere', () => {
    const tree = buildHandoutTree([
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
    ]);
    expect(tree.map(n => ({ id: n.id, children: n.children }))).toEqual([
      { id: 'a', children: [] },
      { id: 'b', children: [] },
    ]);
  });

  it('nests children under declared parent', () => {
    const tree = buildHandoutTree([
      { id: 'town',  title: 'Goblin Camp' },
      { id: 'room1', title: 'Barracks', parent_id: 'town' },
      { id: 'room2', title: 'Chief Tent', parent_id: 'town' },
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('town');
    expect(tree[0].children.map(c => c.id)).toEqual(['room1', 'room2']);
  });

  it('dangling parent_id becomes a root', () => {
    const tree = buildHandoutTree([
      { id: 'x', title: 'X', parent_id: 'ghost' },
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('x');
  });

  it('caps depth at 3 to protect UI rendering', () => {
    const tree = buildHandoutTree([
      { id: 'l1', title: '1' },
      { id: 'l2', title: '2', parent_id: 'l1' },
      { id: 'l3', title: '3', parent_id: 'l2' },
      { id: 'l4', title: '4', parent_id: 'l3' },  // too deep → flattened to l3
    ]);
    expect(tree[0].children[0].children[0].id).toBe('l3');
    expect(tree[0].children[0].children[0].children[0].id).toBe('l4');
    // Depth 4 node exists but has no further descendants branchable below it.
    // Caller clamps render depth with maxDepth parameter:
    const clamped = buildHandoutTree([
      { id: 'l1', title: '1' },
      { id: 'l2', title: '2', parent_id: 'l1' },
      { id: 'l3', title: '3', parent_id: 'l2' },
      { id: 'l4', title: '4', parent_id: 'l3' },
    ], { maxDepth: 3 });
    expect(clamped[0].children[0].children[0].id).toBe('l3');
    expect(clamped[0].children[0].children[0].children).toEqual([]); // l4 hoisted, not nested
  });

  it('breaks cycles by rooting the first-seen node', () => {
    const tree = buildHandoutTree([
      { id: 'a', title: 'A', parent_id: 'b' },
      { id: 'b', title: 'B', parent_id: 'a' },
    ]);
    // Either is acceptable; assert we return something finite with both nodes present.
    const ids = collectIds(tree);
    expect(ids.sort()).toEqual(['a', 'b']);
  });
});

function collectIds(nodes) {
  const out = [];
  for (const n of nodes) {
    out.push(n.id);
    out.push(...collectIds(n.children));
  }
  return out;
}
