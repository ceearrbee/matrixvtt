import { RuleTester } from 'eslint';
import rule from '../no-imperative-dom-patch-near-preact.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-imperative-dom-patch-near-preact', rule, {
  valid: [
    // Reads — only writes are flagged.
    `const t = document.querySelector('#x').textContent;`,
    // Mutations on a variable (indirection) — out of scope; the rule
    // is intentionally narrow to the direct chain shape.
    `const el = document.querySelector('#x'); el.textContent = 'y';`,
    // Inside a nested function (event handler) — fires on action.
    `function Comp() { const onClick = () => document.querySelector('#x').textContent = 'y'; return null; }`,
    `function Comp() { const reset = () => document.getElementById('x').classList.add('foo'); return null; }`,
    // Patches on objects that aren't a document query.
    `someNode.textContent = 'y';`,
    `myEl.classList.add('foo');`,
  ],
  invalid: [
    {
      code: `document.querySelector('#x').textContent = 'y';`,
      errors: [{ messageId: 'imperativePatch' }],
    },
    {
      code: `document.getElementById('x').innerHTML = '<p/>';`,
      errors: [{ messageId: 'imperativePatch' }],
    },
    {
      code: `document.querySelector('.y').setAttribute('aria-busy', 'true');`,
      errors: [{ messageId: 'imperativePatch' }],
    },
    {
      code: `document.querySelector('.y').classList.add('on');`,
      errors: [{ messageId: 'imperativePatch' }],
    },
    {
      code: `document.getElementById('x').classList.remove('off');`,
      errors: [{ messageId: 'imperativePatch' }],
    },
  ],
});
