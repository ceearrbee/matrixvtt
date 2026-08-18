import { RuleTester } from 'eslint';
import rule from '../no-tombstone-or-fallback.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-tombstone-or-fallback', rule, {
  valid: [
    // ?? is fine — only fires for null/undefined.
    `const x = content ?? {};`,
    `const x = event.content ?? { mode: 'hidden' };`,
    // LHS is not content-shaped.
    `const x = some.unrelated || {};`,
    // RHS is not an empty object/array literal we care about.
    `const x = content || someFn();`,
  ],
  invalid: [
    {
      code: `const x = content || {};`,
      errors: [{ messageId: 'tombstoneTrap' }],
    },
    {
      code: `sm.fog = content || { mode: 'hidden' };`,
      errors: [{ messageId: 'tombstoneTrap' }],
    },
    {
      code: `const x = event.content || [];`,
      errors: [{ messageId: 'tombstoneTrap' }],
    },
    {
      code: `const x = roomData.state || {};`,
      errors: [{ messageId: 'tombstoneTrap' }],
    },
    {
      code: `const x = events?.[0]?.content || {};`,
      errors: [{ messageId: 'tombstoneTrap' }],
    },
  ],
});
