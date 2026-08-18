/**
 * commonissues.md §4.2 / §8.1 — direct `.remove()` on a modal element bypasses
 * the cleanup pipeline owned by `ModalFactory`:
 *   - the capture-phase Escape listener stays bound to `document`
 *   - the refcounted body-scroll lock never decrements
 *   - focus is not restored to the opener
 *
 * Canonical fix: `ModalFactory.close(id)` — runs the same teardown the X
 * button uses.
 *
 * This rule flags `document.getElementById('…-modal').remove()` (and the
 * `?.remove()` variant) where the id literal contains "modal". For
 * legitimate orphan-cleanup-before-mount, opt out with an
 * `// eslint-disable-next-line vtt/no-direct-modal-remove` comment + brief
 * justification — those sites are also fair game for a future
 * `ModalFactory.removeStale(id)` helper.
 *
 * `utils/modals.js` is the factory itself and is exempt.
 */

const MODAL_ID_RE = /modal/i;

function isGetElementByIdModal(node) {
  if (node?.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee?.type !== 'MemberExpression') return false;
  if (callee.object?.type !== 'Identifier' || callee.object.name !== 'document') return false;
  if (callee.property?.type !== 'Identifier' || callee.property.name !== 'getElementById') return false;
  const arg = node.arguments?.[0];
  if (arg?.type !== 'Literal' || typeof arg.value !== 'string') return false;
  return MODAL_ID_RE.test(arg.value);
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid direct `.remove()` on modal elements; use `ModalFactory.close(id)` so cleanup runs.',
    },
    schema: [],
    messages: {
      directRemove:
        "Direct `.remove()` on `document.getElementById('{{id}}')` bypasses the modal cleanup pipeline " +
        '(body-scroll lock, Escape listener, focus restore). Use `ModalFactory.close(\'{{id}}\')` instead. ' +
        'If this is orphan-cleanup before mounting a fresh modal, add an eslint-disable comment with the reason.',
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename?.() || '';
    // The factory itself is allowed to call .remove() internally.
    if (filename.endsWith('/utils/modals.js')) return {};

    return {
      'CallExpression'(node) {
        const callee = node.callee;
        if (callee?.type !== 'MemberExpression') return;
        if (callee.property?.type !== 'Identifier' || callee.property.name !== 'remove') return;
        // Direct chain: document.getElementById('x-modal').remove() or ?.remove()
        if (isGetElementByIdModal(callee.object)) {
          const id = callee.object.arguments[0].value;
          context.report({ node, messageId: 'directRemove', data: { id } });
        }
      },
    };
  },
};
