/**
 * Build a parent→children tree from a flat list of handouts.
 *
 * Each handout may carry `parent_id`. Missing, dangling, or circular parents
 * demote the node to a root. `maxDepth` clamps rendering - nodes deeper than
 * the clamp are hoisted up to live alongside their depth-limited ancestor.
 */

const DEFAULT_MAX_DEPTH = Infinity;

export function buildHandoutTree(handouts, { maxDepth = DEFAULT_MAX_DEPTH } = {}) {
  const byId = new Map();
  for (const h of handouts) byId.set(h.id, { ...h, children: [] });

  const createsCycle = (childId, parentId) => {
    const seen = new Set();
    let cursor = parentId;
    while (cursor && byId.has(cursor) && !seen.has(cursor)) {
      if (cursor === childId) return true;
      seen.add(cursor);
      cursor = byId.get(cursor).parent_id;
    }
    return false;
  };

  const attached = new Set();
  const roots = [];

  for (const h of handouts) {
    const node = byId.get(h.id);
    const parentId = h.parent_id;

    if (!parentId || !byId.has(parentId) || createsCycle(h.id, parentId)) {
      roots.push(node);
      attached.add(node.id);
      continue;
    }

    byId.get(parentId).children.push(node);
    attached.add(node.id);
  }

  // Any node still untouched (shouldn't happen but defensive).
  for (const [id, node] of byId) {
    if (!attached.has(id)) roots.push(node);
  }

  if (maxDepth !== Infinity) clampDepth(roots, maxDepth);
  return roots;
}

function clampDepth(nodes, maxDepth, depth = 1) {
  for (const n of nodes) {
    if (depth >= maxDepth) {
      // Hoist descendants up alongside n (flatten below the clamp).
      const hoisted = [];
      collectDescendants(n, hoisted);
      n.children = [];
      nodes.push(...hoisted);
    } else {
      clampDepth(n.children, maxDepth, depth + 1);
    }
  }
}

function collectDescendants(node, out) {
  for (const c of node.children) {
    out.push({ ...c, children: [] });
    collectDescendants(c, out);
  }
}
