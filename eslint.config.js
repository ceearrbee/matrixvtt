import js from '@eslint/js';
import security from 'eslint-plugin-security';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import vtt from './eslint-rules/index.js';

export default [
  js.configs.recommended,

  // Security plugin - flags innerHTML sinks, regex DoS, object injection, eval, etc.
  security.configs.recommended,

  // Prettier compatibility - disables ESLint rules that conflict with formatting
  prettier,

  // Project-wide overrides
  {
    files: ['src/**/*.js', 'src/**/*.jsx'],
    plugins: { vtt },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
        __APP_VERSION__: 'readonly',
      },
    },
    rules: {
      // innerHTML is intentional; all user data goes through esc() before insertion.
      // Keep as warn rather than off so new usages are still flagged for review.
      'security/detect-non-literal-fs-filename': 'warn',
      // detect-object-injection has a very high false-positive rate on this
      // codebase (validated ruleset keys, bounded numeric loop indices,
      // dispatch maps keyed on hard-coded `kind` strings). Suppressing
      // ~160 sites inline would bury the actual signal; we rely on XSS-
      // focused rules (`detect-non-literal-fs-filename`, manual review of
      // `innerHTML` sinks) for the real injection class instead.
      'security/detect-object-injection': 'off',

      // Unused vars: allow leading-underscore convention for intentionally unused params.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],

      // Consistent equality - catches the null-bypass class of bugs already seen in this repo.
      'eqeqeq': ['error', 'always', { null: 'ignore' }],

      // No reassigning native globals (document, window, etc.)
      'no-global-assign': 'error',

      // Catch accidental variable shadowing
      'no-shadow': ['warn', { allow: ['err', 'e', 'event'] }],

      // Custom rules for recurring bug classes.
      'vtt/no-bare-bool-form-schema': 'error',
      'vtt/no-tombstone-or-fallback': 'warn',
      'vtt/yjs-bridge-must-route-through-apply': 'error',
      'vtt/no-direct-modal-remove': 'error',
      'vtt/no-raw-html-interpolation': 'error',
    }
  },

  // Reactivity guardrails - only apply to JSX render bodies.
  // See commonissues.md §1.
  {
    files: ['src/**/*.jsx'],
    rules: {
      'vtt/no-dom-attr-read-in-jsx': 'error',
      'vtt/no-direct-localstorage-in-jsx': 'error',
      'vtt/no-imperative-dom-patch-near-preact': 'warn',
    },
  },

  // Relax rules in test files - mocks legitimately use things like object injection
  {
    files: ['**/*.test.js', '**/*.test.jsx', '**/*.spec.js', 'tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node, // for `global.alert = vi.fn()` patterns in Vitest
      },
    },
    rules: {
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-non-literal-regexp': 'off',
      'no-unused-vars': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Tests build mock DOM with hardcoded fixture strings - not a real
      // XSS surface and the rule lights up on every fixture template.
      'vtt/no-raw-html-interpolation': 'off',
    }
  },

  // Ignore generated / dependency output and vendored bundles
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'public/sw.js',
      // Vendored / minified third-party bundles checked in to src/
      'src/matrix-widget-api.js',
      'src/matrix-widget-stub.js',
    ],
  },
];
