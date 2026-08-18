import { RuleTester } from 'eslint';
import rule from '../no-raw-html-interpolation.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-raw-html-interpolation', rule, {
  valid: [
    // Pure literal — no interpolation.
    `h('div', { dangerouslySetInnerHTML: { __html: '<b>fixed</b>' } });`,
    // All-safe interpolation (escape + sanitised markdown).
    `h('div', { dangerouslySetInnerHTML: { __html: \`<b>\${esc(name)}</b> \${renderMarkdown(body)}\` } });`,
    // Conditional and logical wrapping of safe producers.
    `h('div', { dangerouslySetInnerHTML: { __html: \`\${flag ? renderMarkdown(x) : ''}\` } });`,
    `h('div', { dangerouslySetInnerHTML: { __html: \`\${flag && esc(y)}\` } });`,
    // Direct DOMPurify call.
    `el.innerHTML = \`\${DOMPurify.sanitize(dirty)}\`;`,
    // Non-HTML sink.
    `obj.value = \`hello \${name}\`;`,
    // Coercion via String/Number.
    `el.innerHTML = \`<i>\${String(n)}</i>\`;`,
  ],
  invalid: [
    // The real bug: raw identifier.
    {
      code: `h('div', { dangerouslySetInnerHTML: { __html: \`<b>\${action.damage}</b>\` } });`,
      errors: [{ messageId: 'rawInterpolation' }],
    },
    // Mixed safe + unsafe — still flagged.
    {
      code: `h('div', { dangerouslySetInnerHTML: { __html: \`\${renderMarkdown(x)} \${user.note}\` } });`,
      errors: [{ messageId: 'rawInterpolation' }],
    },
    // innerHTML sink.
    {
      code: `el.innerHTML = \`<p>\${msg}</p>\`;`,
      errors: [{ messageId: 'rawInterpolation' }],
    },
  ],
});
