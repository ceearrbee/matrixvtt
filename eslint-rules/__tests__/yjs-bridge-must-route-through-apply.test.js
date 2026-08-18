import { RuleTester } from 'eslint';
import rule from '../yjs-bridge-must-route-through-apply.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

// The rule is file-scoped to stateManager-yjs-bridges.js, so all test
// cases use that filename.
const filename = '/abs/path/src/state/stateManager-yjs-bridges.js';

tester.run('yjs-bridge-must-route-through-apply', rule, {
  valid: [
    // Routing through applySettings — the canonical fix.
    { filename, code: `function f(sm, val) { sm.settings = applySettings(sm, val ?? {}); }` },
    // Assigning a non-enforced field is fine (no apply* registered yet).
    { filename, code: `function f(sm, val) { sm.initiative = val; }` },
    { filename, code: `function f(sm, val) { sm.drawings = Array.isArray(val) ? val : []; }` },
    // In other files, the rule is inert.
    { filename: '/abs/path/src/other.js', code: `function f(sm, val) { sm.settings = val; }` },
  ],
  invalid: [
    {
      filename,
      code: `function f(sm, val) { sm.settings = val ?? {}; }`,
      errors: [{ messageId: 'directBridgeAssign' }],
    },
    {
      filename,
      code: `function f(sm, val) { sm.settings = { ...val }; }`,
      errors: [{ messageId: 'directBridgeAssign' }],
    },
    {
      filename,
      // RHS calls something *other* than applySettings.
      code: `function f(sm, val) { sm.settings = normalize(val); }`,
      errors: [{ messageId: 'directBridgeAssign' }],
    },
  ],
});
