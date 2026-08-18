/**
 * Forbid bare-string form-schema entries for bool-leaning field
 * names. Without `type: 'bool'`, FormReader reads `field.value`
 * (a string) for a checkbox, and Valibot rejects the resulting
 * boolean field.
 */

const FN_NAME_RE = /(FormSchema|^_get.*Schema$)/;
const BOOL_KEY_RE =
  /^(equipped|concentration|ritual|is_|has_|show_|hide_|enable_|disable_|sync_|send_|live_|visible|hidden|active)/;

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Form-schema entries for boolean fields must declare type: bool' },
    schema: [],
    messages: {
      mustDeclareBool:
        "Form-schema entry '{{key}}' looks like a boolean field — declare it as " +
        "{ id: '...', type: 'bool' } so FormReader reads checkbox.checked.",
    },
  },
  create(context) {
    function check(fnName, returnedObject) {
      if (!fnName || !FN_NAME_RE.test(fnName)) return;
      if (!returnedObject || returnedObject.type !== 'ObjectExpression') return;
      for (const prop of returnedObject.properties) {
        if (prop.type !== 'Property' || prop.computed) continue;
        const key =
          prop.key.type === 'Identifier'
            ? prop.key.name
            : prop.key.type === 'Literal'
              ? String(prop.key.value)
              : null;
        if (!key || !BOOL_KEY_RE.test(key)) continue;
        if (prop.value.type === 'ObjectExpression') {
          const hasBoolType = prop.value.properties.some(
            (p) =>
              p.type === 'Property' &&
              p.key.type === 'Identifier' &&
              p.key.name === 'type' &&
              p.value.type === 'Literal' &&
              p.value.value === 'bool',
          );
          if (hasBoolType) continue;
        }
        context.report({ node: prop, messageId: 'mustDeclareBool', data: { key } });
      }
    }

    function findReturnObject(body) {
      for (const stmt of body) {
        if (stmt.type === 'ReturnStatement' && stmt.argument?.type === 'ObjectExpression') {
          return stmt.argument;
        }
      }
      return null;
    }

    return {
      FunctionDeclaration(node) {
        check(node.id?.name, findReturnObject(node.body.body));
      },
      VariableDeclarator(node) {
        if (
          node.init?.type === 'FunctionExpression' ||
          node.init?.type === 'ArrowFunctionExpression'
        ) {
          const body = node.init.body.type === 'BlockStatement' ? node.init.body.body : null;
          if (body) check(node.id.name, findReturnObject(body));
        }
      },
    };
  },
};
