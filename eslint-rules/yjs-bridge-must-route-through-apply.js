/**
 * In `src/state/stateManager-yjs-bridges.js`, flag direct
 * `sm.<field> = <value>` assignments for fields that have a matching
 * `apply<Field>` normalizer in `src/state/syncer-apply.js`.
 *
 * Background — the settings bridge once wrote `sm.settings = val` raw,
 * which left `systemConfig` undefined because `updateSettings` strips
 * it on write (preset is re-resolved at read time). Every
 * config-driven character-sheet section silently rendered nothing.
 * Routing through `applySettings(sm, val)` is the canonical fix.
 *
 * Currently enforced fields:
 *   - settings  → must go through applySettings(sm, ...)
 *
 * (Other apply* exports — applyMap, applyFog, applyDrawing — take
 * non-drop-in signatures, so they're not enforced as auto-routes
 * yet. Add them here when they have singleton-friendly wrappers.)
 */

const ENFORCED = {
  settings: 'applySettings',
};

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'In stateManager-yjs-bridges.js, sm.<field> singleton assignments must route through the corresponding apply<Field> normalizer.',
    },
    schema: [],
    messages: {
      directBridgeAssign:
        "Direct `sm.{{field}} = …` in a Yjs bridge bypasses normalization. " +
        "Route through `{{helper}}(sm, val)` from `src/state/syncer-apply.js`.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename?.() || '';
    if (!filename.endsWith('stateManager-yjs-bridges.js')) return {};

    return {
      AssignmentExpression(node) {
        if (node.operator !== '=') return;
        const lhs = node.left;
        if (lhs?.type !== 'MemberExpression') return;
        if (lhs.object?.type !== 'Identifier' || lhs.object.name !== 'sm') return;
        if (lhs.property?.type !== 'Identifier') return;
        const field = lhs.property.name;
        const helper = ENFORCED[field];
        if (!helper) return;

        // OK if RHS is a direct call to the canonical helper.
        const rhs = node.right;
        if (
          rhs?.type === 'CallExpression'
          && rhs.callee?.type === 'Identifier'
          && rhs.callee.name === helper
        ) {
          return;
        }
        context.report({
          node,
          messageId: 'directBridgeAssign',
          data: { field, helper },
        });
      },
    };
  },
};
