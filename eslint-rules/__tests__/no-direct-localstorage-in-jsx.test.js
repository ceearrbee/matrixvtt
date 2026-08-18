import { RuleTester } from 'eslint';
import rule from '../no-direct-localstorage-in-jsx.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-direct-localstorage-in-jsx', rule, {
  valid: [
    // Importing the hook exempts the whole file.
    `import { useStorageSubscription } from '../hooks/use-storage.js';
     localStorage.getItem('foo');`,
    // Calls on other objects aren't flagged.
    `sessionStorage.getItem('foo');`,
    `myStore.getItem('foo');`,
    // Property reads (not calls) aren't flagged — let the broader audit handle that shape.
    `const len = localStorage.length;`,
    // Calls inside a nested function (e.g. an event handler) fire on action, not render.
    `function Comp() { const reset = () => { localStorage.clear(); localStorage.setItem('k', '1'); }; return reset; }`,
    `function Comp() { const onClick = () => localStorage.getItem('k'); return null; }`,
  ],
  invalid: [
    {
      code: `const v = localStorage.getItem('key');`,
      errors: [{ messageId: 'directLocalStorage' }],
    },
    {
      // Inside the component body but NOT in a nested function — the bug shape.
      code: `function Comp() { const v = localStorage.getItem('k'); return v; }`,
      errors: [{ messageId: 'directLocalStorage' }],
    },
    {
      code: `localStorage.setItem('k', '1');`,
      errors: [{ messageId: 'directLocalStorage' }],
    },
    {
      code: `localStorage.removeItem('k');`,
      errors: [{ messageId: 'directLocalStorage' }],
    },
    {
      // Default import shape does NOT count as importing the hook.
      code: `import foo from './something.js'; localStorage.getItem('k');`,
      errors: [{ messageId: 'directLocalStorage' }],
    },
  ],
});
