import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/smoke/**/*.{test,spec}.{js,mjs,cjs}'],
    exclude: ['node_modules/**', '.clone/**'],
    globals: true,
    testTimeout: 10000
  }
});
