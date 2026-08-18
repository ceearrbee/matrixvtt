import { RuleTester } from 'eslint';
import rule from '../no-direct-modal-remove.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-direct-modal-remove', rule, {
  valid: [
    // Non-modal ids — out of scope.
    `document.getElementById('toast')?.remove();`,
    // Going through the factory — the canonical fix.
    `ModalFactory.close('preview-modal');`,
    // Removing a non-getElementById expression.
    `someNode.remove();`,
    // Variable indirection — out of scope (could be a modal or anything;
    // the rule intentionally stays narrow to the direct chain shape).
    `const m = document.getElementById('preview-modal'); m.remove();`,
  ],
  invalid: [
    {
      code: `document.getElementById('preview-modal').remove();`,
      errors: [{ messageId: 'directRemove' }],
    },
    {
      code: `document.getElementById('preview-modal')?.remove();`,
      errors: [{ messageId: 'directRemove' }],
    },
    {
      code: `document.getElementById('confirm-modal')?.remove();`,
      errors: [{ messageId: 'directRemove' }],
    },
  ],
});
