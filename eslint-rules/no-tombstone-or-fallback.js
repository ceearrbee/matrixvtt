/**
 * Warn on `content || {}` (or `[]`) patterns. An empty object is
 * truthy in JS, so the fallback never fires on a tombstoned event.
 * Use `??` (only null/undefined triggers fallback) or an explicit
 * `Object.keys(c).length === 0` check.
 */

const CONTENT_NAMES = new Set(['content', 'event', 'roomData', 'e']);

function isContentShaped(node) {
  if (!node) return false;
  if (node.type === 'ChainExpression') return isContentShaped(node.expression);
  if (node.type === 'Identifier' && CONTENT_NAMES.has(node.name)) return true;
  if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
    if (node.property?.type === 'Identifier' && CONTENT_NAMES.has(node.property.name)) return true;
    return isContentShaped(node.object);
  }
  return false;
}

function isEmptyLiteralFallback(node) {
  if (!node) return false;
  if (node.type === 'ObjectExpression') {
    // `{}` or any inline literal default — flag as a tombstone trap.
    return !node.properties.some((p) => p.type === 'SpreadElement');
  }
  if (node.type === 'ArrayExpression') {
    return !node.elements.some((el) => el?.type === 'SpreadElement');
  }
  return false;
}

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Warn on `content || default` patterns; empty content `{}` is truthy and skips the fallback.',
    },
    schema: [],
    messages: {
      tombstoneTrap:
        "Empty object/array fallback won't fire when content is `{}` (truthy). " +
        "Use `??` for null/undefined, or check Object.keys(content).length === 0 explicitly.",
    },
  },
  create(context) {
    return {
      LogicalExpression(node) {
        if (node.operator !== '||') return;
        if (!isContentShaped(node.left)) return;
        if (!isEmptyLiteralFallback(node.right)) return;
        context.report({ node, messageId: 'tombstoneTrap' });
      },
    };
  },
};
