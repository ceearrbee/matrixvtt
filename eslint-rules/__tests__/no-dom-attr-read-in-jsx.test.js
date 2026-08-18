import { RuleTester } from 'eslint';
import rule from '../no-dom-attr-read-in-jsx.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-dom-attr-read-in-jsx', rule, {
  valid: [
    // Reading inside an event handler is fine — fires on action, not render.
    `const el = h('button', { onClick: () => document.documentElement.getAttribute('data-theme') });`,
    `const el = h('div', { onChange: () => getComputedStyle(document.body).getPropertyValue('--x') });`,
    `const obj = { onClick: () => document.body.dataset.theme };`,
    // Reads from unrelated objects pass through.
    `const x = some.thing.getAttribute('data-x');`,
    `const ds = local.dataset.X;`,
    // Other functions named getAttribute on non-document chains.
    `const x = el.getAttribute('foo');`,
  ],
  invalid: [
    {
      code: `function Header() { const t = document.documentElement.getAttribute('data-theme'); return null; }`,
      errors: [{ messageId: 'domAttrRead' }],
    },
    {
      code: `function Comp() { const v = getComputedStyle(document.body).getPropertyValue('--sheet-width'); return v; }`,
      errors: [{ messageId: 'computedStyleRead' }],
    },
    {
      code: `const x = document.body.dataset.theme;`,
      errors: [{ messageId: 'datasetRead' }],
    },
    {
      code: `const x = document.documentElement.dataset.something;`,
      errors: [{ messageId: 'datasetRead' }],
    },
    {
      code: `const t = document.documentElement.getAttribute('data-theme');`,
      errors: [{ messageId: 'domAttrRead' }],
    },
  ],
});
