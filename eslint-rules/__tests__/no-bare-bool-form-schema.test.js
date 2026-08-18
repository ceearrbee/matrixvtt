/**
 * RuleTester for vtt/no-bare-bool-form-schema. The rule fires when a
 * function whose name matches `*FormSchema` or `_get*Schema` returns
 * an object whose key looks bool-leaning (equipped, concentration,
 * is_*, has_*, etc.) and whose value is a bare string id rather than
 * `{ id, type: 'bool' }`.
 */
import { RuleTester } from 'eslint';
import rule from '../no-bare-bool-form-schema.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-bare-bool-form-schema', rule, {
  valid: [
    // Correct: bool fields declare type
    `export function getItemFormSchema() {
      return { name: 'item-name', equipped: { id: 'item-equipped', type: 'bool' } };
    }`,
    // Function name doesn't match — rule does not fire
    `function unrelated() { return { equipped: 'item-equipped' }; }`,
    // Field name is not bool-leaning
    `export function _getItemSchema() { return { name: 'item-name' }; }`,
    // Bool-leaning name but valid object shape
    `function _getSpellSchema() {
      return { concentration: { id: 'spell-concentration', type: 'bool' } };
    }`,
  ],
  invalid: [
    {
      code: `export function getItemFormSchema() {
        return { equipped: 'item-equipped' };
      }`,
      errors: [{ messageId: 'mustDeclareBool', data: { key: 'equipped' } }],
    },
    {
      code: `function _getSpellSchema() {
        return {
          concentration: 'spell-concentration',
          ritual: 'spell-ritual',
        };
      }`,
      errors: [
        { messageId: 'mustDeclareBool', data: { key: 'concentration' } },
        { messageId: 'mustDeclareBool', data: { key: 'ritual' } },
      ],
    },
    {
      code: `function _getEntitySchema() {
        return { is_hidden: 'entity-hidden' };
      }`,
      errors: [{ messageId: 'mustDeclareBool', data: { key: 'is_hidden' } }],
    },
  ],
});
