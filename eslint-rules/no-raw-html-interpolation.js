/**
 * commonissues.md §12.1 — XSS via raw `${…}` interpolation into HTML.
 *
 * Pattern: a template literal is interpolated into `dangerouslySetInnerHTML`
 * with embedded identifiers / property reads, AND those expressions aren't
 * obvious "already-safe HTML" sources (a sanitiser call, a literal, etc.).
 *
 * Real-world hit: `characterSheetSections.js` built
 *   `${action.damage ? `<b>${action.damage}</b> · ` : ''}${renderMarkdown(...)}`
 * and fed it to dangerouslySetInnerHTML. `action.damage` is GM-authored
 * free-text from an input field — full XSS surface.
 *
 * What's allowed inside the template (no warning):
 *  - Literal strings (`'<br>'`, `"foo"`).
 *  - Calls to a known-safe HTML producer: `renderMarkdown`, `DOMPurify.sanitize`,
 *    `esc`, `escapeHtml`, `escapeHtmlAttribute`, `safeHtml`. The producer name
 *    is what we recognise; what it actually returns is the producer's contract.
 *  - Calls to `String(...)`/`Number(...)` (coerces; not HTML).
 *
 * Anything else inside the template interpolation triggers the rule.
 *
 * Use cases to consider when triaging a violation:
 *  - You want raw HTML from a trusted source → wrap in a one-line helper
 *    named `safeHtml(...)` or pipe through `renderMarkdown` / `DOMPurify`.
 *  - The value is a number / id you control → coerce via `String(x)` or
 *    interpolate as text via h(...) children instead of HTML.
 *  - The value is from user / Matrix input → escape with `esc()` or render
 *    via Preact text children.
 */

const SAFE_CALLEES = new Set([
  'renderMarkdown',
  'esc',
  'escapeHtml',
  'escapeHtmlAttribute',
  'safeHtml',
  'String',
  'Number',
]);

function isSafeCallExpression(node) {
  if (node?.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee?.type === 'Identifier') return SAFE_CALLEES.has(callee.name);
  // DOMPurify.sanitize(...), MarkdownIt.render(...), etc.
  if (callee?.type === 'MemberExpression' && callee.property?.type === 'Identifier') {
    const name = callee.property.name;
    if (name === 'sanitize' || name === 'render') return true;
  }
  return false;
}

function isSafeExpression(node) {
  if (!node) return true;
  if (node.type === 'Literal') return true;
  // Conditional: both branches must be safe.
  if (node.type === 'ConditionalExpression') {
    return isSafeExpression(node.consequent) && isSafeExpression(node.alternate);
  }
  // Logical: `cond && safeContent` is the dominant pattern — the left
  // operand is a guard that resolves to a falsy value (renders as empty)
  // or short-circuits to `safeContent`. So `&&` only requires the right
  // side to be a safe HTML producer. `||` could pick either side, so
  // both must be safe.
  if (node.type === 'LogicalExpression') {
    if (node.operator === '&&') return isSafeExpression(node.right);
    return isSafeExpression(node.left) && isSafeExpression(node.right);
  }
  // Template literal nested inside — recurse.
  if (node.type === 'TemplateLiteral') {
    return node.expressions.every(isSafeExpression);
  }
  return isSafeCallExpression(node);
}

function templateHasUnsafeInterpolation(node) {
  if (node?.type !== 'TemplateLiteral') return false;
  if (node.expressions.length === 0) return false;
  return node.expressions.some((expr) => !isSafeExpression(expr));
}

/**
 * Match `{ __html: <expr> }`. JSX shape ends up as an ObjectExpression
 * property either way (after JSX transform OR in `h(...)` form).
 */
function isHtmlProperty(prop) {
  if (prop.type !== 'Property') return false;
  if (prop.key?.type === 'Identifier' && prop.key.name === '__html') return true;
  if (prop.key?.type === 'Literal' && prop.key.value === '__html') return true;
  return false;
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid raw `${…}` interpolation into `dangerouslySetInnerHTML` / `innerHTML` strings. ' +
        'Each interpolated expression must come from a known-safe HTML producer ' +
        '(renderMarkdown, esc/escapeHtml, DOMPurify.sanitize, …) or be a literal.',
    },
    schema: [],
    messages: {
      rawInterpolation:
        'Template literal feeding {{sink}} has an interpolated expression that is not from a ' +
        'known-safe HTML producer ({{safeList}}). If the value is trusted but un-marked, wrap it ' +
        'in `safeHtml(...)`; if it is user-authored, escape with `esc(...)` or render via ' +
        "Preact text children.",
    },
  },
  create(context) {
    const safeListMsg = '`' + Array.from(SAFE_CALLEES).join('`, `') + '`, `*.sanitize`, `*.render`';

    function checkTemplate(template, sinkLabel) {
      if (templateHasUnsafeInterpolation(template)) {
        context.report({
          node: template,
          messageId: 'rawInterpolation',
          data: { sink: sinkLabel, safeList: safeListMsg },
        });
      }
    }

    return {
      // dangerouslySetInnerHTML: { __html: `…${x}…` }
      'Property'(node) {
        if (!isHtmlProperty(node)) return;
        // Look at the value: it can be a TemplateLiteral directly, OR an
        // identifier whose binding is a TemplateLiteral. The direct form is
        // the dominant bug shape; binding-following is out of scope.
        if (node.value?.type === 'TemplateLiteral') {
          checkTemplate(node.value, '`dangerouslySetInnerHTML.__html`');
        }
      },
      // someEl.innerHTML = `…${x}…` (catches the non-JSX sink too)
      'AssignmentExpression'(node) {
        if (node.operator !== '=') return;
        if (node.left?.type !== 'MemberExpression') return;
        if (node.left.property?.type !== 'Identifier') return;
        if (node.left.property.name !== 'innerHTML' && node.left.property.name !== 'outerHTML') return;
        if (node.right?.type !== 'TemplateLiteral') return;
        checkTemplate(node.right, '`.' + node.left.property.name + '`');
      },
    };
  },
};
