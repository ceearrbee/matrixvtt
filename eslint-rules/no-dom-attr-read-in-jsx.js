/**
 * Flag DOM-attribute / computed-style reads inside `*.jsx` files.
 *
 * Background — Preact components subscribe to signals during render.
 * Reading `document.documentElement.getAttribute('data-theme')` /
 * `getComputedStyle(...).getPropertyValue(...)` / `document.body.dataset.X`
 * returns the current DOM state but doesn't register a reactive
 * dependency, so the component never re-renders when the underlying
 * attribute changes. That was the theme-tooltip-stuck-on-high-contrast
 * bug (see commit 352d8f5). Same shape can hit `prefers-color-scheme`
 * reads via `getComputedStyle` etc.
 *
 * Canonical fix: back the attribute with a signal in
 * `src/state/ui-signals.js`, route all writers through a helper that
 * updates BOTH the DOM and the signal, and have the component read
 * from the signal. See `themeSignal` for the reference shape.
 *
 * Inside event handlers (`onClick`, `onChange`, …) DOM reads are fine
 * because they fire on user action, not render. We skip those.
 */

const BANNED_GETATTR_RECEIVERS = new Set([
  'documentElement',
  'body',
  'head',
]);

function isEnclosedByEventHandler(node) {
  // Walk up to find a JSX attribute named `on…` containing this expression.
  for (let cur = node.parent; cur; cur = cur.parent) {
    if (cur.type === 'JSXAttribute' && /^on[A-Z]/.test(cur.name?.name ?? '')) return true;
    // Inside a property like `{ onClick: () => … }` in a plain JS call to `h(...)`.
    if (cur.type === 'Property' && cur.key?.type === 'Identifier' && /^on[A-Z]/.test(cur.key.name)) return true;
  }
  return false;
}

function isDocumentMemberCall(callee, member) {
  // `document.documentElement.getAttribute(...)` etc.
  if (callee?.type !== 'MemberExpression') return false;
  if (callee.property?.type !== 'Identifier') return false;
  if (callee.property.name !== member) return false;
  const obj = callee.object;
  if (obj?.type !== 'MemberExpression') return false;
  if (obj.object?.type !== 'Identifier' || obj.object.name !== 'document') return false;
  if (obj.property?.type !== 'Identifier') return false;
  return BANNED_GETATTR_RECEIVERS.has(obj.property.name);
}

function isDatasetAccess(node) {
  // `document.body.dataset.<name>` or `document.documentElement.dataset.<name>`.
  if (node?.type !== 'MemberExpression') return false;
  const datasetNode = node.object;
  if (datasetNode?.type !== 'MemberExpression') return false;
  if (datasetNode.property?.type !== 'Identifier' || datasetNode.property.name !== 'dataset') return false;
  const docMember = datasetNode.object;
  if (docMember?.type !== 'MemberExpression') return false;
  if (docMember.object?.type !== 'Identifier' || docMember.object.name !== 'document') return false;
  return docMember.property?.type === 'Identifier' && BANNED_GETATTR_RECEIVERS.has(docMember.property.name);
}

function isGetComputedStyleCall(node) {
  return node?.type === 'CallExpression'
    && node.callee?.type === 'Identifier'
    && node.callee.name === 'getComputedStyle';
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid DOM-attribute reads (document.documentElement.getAttribute, getComputedStyle, dataset access) inside Preact component render bodies — they bypass signal subscription and produce stale UI.',
    },
    schema: [],
    messages: {
      domAttrRead:
        "DOM attribute read in render bypasses Preact reactivity. Back the value with a signal in src/state/ui-signals.js and read from it instead. (See themeSignal for the pattern.)",
      datasetRead:
        "`document.{body,documentElement,head}.dataset.X` read in render bypasses Preact reactivity. Use a signal-backed alternative.",
      computedStyleRead:
        "`getComputedStyle()` read in render bypasses Preact reactivity. If you need CSS-driven state in a component, back it with a signal.",
    },
  },
  create(context) {
    return {
      // Match `document.documentElement.getAttribute(...)` etc.
      'CallExpression'(node) {
        if (isEnclosedByEventHandler(node)) return;
        if (isDocumentMemberCall(node.callee, 'getAttribute')) {
          context.report({ node, messageId: 'domAttrRead' });
          return;
        }
        if (isGetComputedStyleCall(node)) {
          context.report({ node, messageId: 'computedStyleRead' });
        }
      },
      // Match `document.body.dataset.X` access patterns.
      'MemberExpression'(node) {
        if (isEnclosedByEventHandler(node)) return;
        if (isDatasetAccess(node)) {
          context.report({ node, messageId: 'datasetRead' });
        }
      },
    };
  },
};
