/**
 * Warn on imperative DOM patches (`document.querySelector(...).textContent = …`,
 * `.classList.add(...)`, `.setAttribute(...)`, `.style.X = …`) inside `*.jsx`
 * files. These race with Preact's render cycle and were the sync-badge
 * `updateSyncBadge()` bug (commit 666b89d removed that helper because
 * the JSX render was overwriting the imperative patch milliseconds
 * later).
 *
 * Canonical fix: express the change reactively (signal → JSX prop).
 *
 * Allow list:
 *  - `utils/modals.js` and `sync-banner.js` are imperative by design.
 *  - Test files (already excluded via the eslint config's test block).
 *  - Calls inside nested functions (event handlers, focus-trap wiring)
 *    fire on action — leave those alone.
 */

const IMPERATIVE_PROPS = new Set([
  'textContent',
  'innerText',
  'innerHTML',
  'value',
]);
const IMPERATIVE_METHODS = new Set([
  'setAttribute',
  'removeAttribute',
]);
const FN_TYPES = new Set([
  'FunctionExpression',
  'ArrowFunctionExpression',
  'FunctionDeclaration',
]);

function isQuerySelectorResult(node) {
  // Either a direct `document.querySelector(...)` / `getElementById(...)`
  // call, or a Variable bound to one. We check the direct chain shape:
  // `document.querySelector(...).foo`. Indirection through a variable
  // would need scope analysis, which we punt on — the direct chain is
  // the dominant bug shape in this repo.
  if (node?.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee?.type !== 'MemberExpression') return false;
  if (callee.object?.type !== 'Identifier' || callee.object.name !== 'document') return false;
  if (callee.property?.type !== 'Identifier') return false;
  return callee.property.name === 'querySelector'
    || callee.property.name === 'querySelectorAll'
    || callee.property.name === 'getElementById';
}

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
    type: 'suggestion',
    docs: {
      description:
        'Warn on imperative DOM patches that race with Preact renders.',
    },
    schema: [],
    messages: {
      imperativePatch:
        "Imperative DOM patch on `document.{{lookup}}(...)` races with Preact renders. " +
        "Express this reactively (signal → JSX prop) instead.",
    },
  },
  create(context) {
    return {
      // Match: document.querySelector(...).<imperativeProp> = X
      'AssignmentExpression'(node) {
        if (node.operator !== '=') return;
        if (isInsideNestedFunction(node)) return;
        const lhs = node.left;
        if (lhs?.type !== 'MemberExpression') return;
        if (lhs.property?.type !== 'Identifier') return;
        if (!IMPERATIVE_PROPS.has(lhs.property.name)) return;
        if (!isQuerySelectorResult(lhs.object)) return;
        context.report({
          node,
          messageId: 'imperativePatch',
          data: { lookup: lhs.object.callee.property.name },
        });
      },
      // Match: document.querySelector(...).setAttribute(...)
      //        document.querySelector(...).classList.{add,remove,toggle}(...)
      'CallExpression'(node) {
        if (isInsideNestedFunction(node)) return;
        const callee = node.callee;
        if (callee?.type !== 'MemberExpression') return;
        if (callee.property?.type !== 'Identifier') return;
        const methodName = callee.property.name;

        // .setAttribute / .removeAttribute directly on a document query.
        if (IMPERATIVE_METHODS.has(methodName) && isQuerySelectorResult(callee.object)) {
          context.report({
            node,
            messageId: 'imperativePatch',
            data: { lookup: callee.object.callee.property.name },
          });
          return;
        }
        // .classList.<add|remove|toggle> — classList is itself a member access.
        if (
          (methodName === 'add' || methodName === 'remove' || methodName === 'toggle')
          && callee.object?.type === 'MemberExpression'
          && callee.object.property?.type === 'Identifier'
          && callee.object.property.name === 'classList'
          && isQuerySelectorResult(callee.object.object)
        ) {
          context.report({
            node,
            messageId: 'imperativePatch',
            data: { lookup: callee.object.object.callee.property.name },
          });
        }
      },
    };
  },
};
