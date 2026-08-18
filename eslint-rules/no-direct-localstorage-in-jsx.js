/**
 * Flag direct `localStorage.{getItem,setItem,removeItem}` calls inside
 * `*.jsx` files when the file does NOT import `useStorageSubscription`.
 *
 * Background — a Preact component that reads localStorage during render
 * doesn't subscribe to the cross-tab `storage` event, so a write in
 * another tab doesn't trigger a re-render. The MapShell `HIDE_MAP_HELP`
 * and CombatAutomationPanel `INIT_MODE_KEY` bugs were both this shape.
 *
 * Canonical fix: `useStorageSubscription` from
 * `src/ui/hooks/use-storage.js` — it wires the storage event and exposes
 * a [value, setValue] pair.
 *
 * Allow list: if `useStorageSubscription` is imported in the same file,
 * we assume the file is using the hook as the primary surface and any
 * direct calls are intentional escape hatches.
 */

const STORAGE_METHODS = new Set(['getItem', 'setItem', 'removeItem']);
const FN_TYPES = new Set([
  'FunctionExpression',
  'ArrowFunctionExpression',
  'FunctionDeclaration',
]);

// A call is "in render" when it's at module top-level or directly inside
// the component function (one function deep from Program). A call inside
// a nested function (event handler, effect callback, etc.) fires on
// invocation, not render, and is fine.
function isInsideNestedFunction(node) {
  let fnDepth = 0;
  for (let cur = node.parent; cur; cur = cur.parent) {
    if (FN_TYPES.has(cur.type)) fnDepth += 1;
    if (fnDepth >= 2) return true;
  }
  return false;
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid direct localStorage calls in `.jsx` files; use `useStorageSubscription` so cross-tab writes trigger re-renders.',
    },
    schema: [],
    messages: {
      directLocalStorage:
        "Direct `localStorage.{{method}}()` in a Preact render body bypasses the cross-tab `storage` event. " +
        "Use `useStorageSubscription` from `src/ui/hooks/use-storage.js` instead.",
    },
  },
  create(context) {
    let usesHook = false;
    return {
      ImportDeclaration(node) {
        for (const spec of node.specifiers) {
          if (
            spec.type === 'ImportSpecifier'
            && spec.imported?.type === 'Identifier'
            && spec.imported.name === 'useStorageSubscription'
          ) {
            usesHook = true;
          }
        }
      },
      'CallExpression'(node) {
        if (usesHook) return;
        if (isInsideNestedFunction(node)) return;
        const callee = node.callee;
        if (callee?.type !== 'MemberExpression') return;
        if (callee.object?.type !== 'Identifier' || callee.object.name !== 'localStorage') return;
        if (callee.property?.type !== 'Identifier') return;
        if (!STORAGE_METHODS.has(callee.property.name)) return;
        context.report({
          node,
          messageId: 'directLocalStorage',
          data: { method: callee.property.name },
        });
      },
    };
  },
};
