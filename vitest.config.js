import { defineConfig } from 'vitest/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import preact from '@preact/preset-vite';

const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8'));

export default defineConfig({
  plugins: [preact()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    // Use happy-dom for DOM testing (lighter than jsdom)
    environment: 'happy-dom',

    // Test file patterns
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['.clone/**', 'node_modules/**', 'tests/smoke/**', 'tests/e2e/**'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/**/*.{test,spec}.{js,jsx}',
        'src/**/__tests__/**',
        'tests/**'
      ],
      // Ratchet floors just under current coverage; raise as coverage grows.
      thresholds: {
        lines: 74,
        functions: 66,
        branches: 63,
        statements: 71
      }
    },

    // Global test setup
    globals: true,
    setupFiles: ['./tests/setup/fail-on-console.js'],

    // Test timeout
    testTimeout: 10000
  }
});
