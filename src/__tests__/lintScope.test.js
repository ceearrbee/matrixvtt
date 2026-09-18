/**
 * `lint` only ever passed `src/`, so tests/ and scripts/ had never been
 * linted, including the e2e fixtures and the version-bump script the
 * P14 tail added. eslint.config.js already carried a `tests/**` block,
 * so the config expected a scope the script never handed it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf8'));

describe('lint scope', () => {
  it('lints every directory holding hand-written code', () => {
    expect(pkg.scripts.lint).toBe('eslint src/ tests/ scripts/ docs/scripts/ eslint-rules/ --max-warnings 0');
    expect(pkg.scripts['lint:fix']).toBe('eslint src/ tests/ scripts/ docs/scripts/ eslint-rules/ --fix');
  });

  it('gates the same directories at commit time', () => {
    const globs = Object.keys(pkg['lint-staged']);
    expect(globs).toEqual(['{src,tests,scripts,docs/scripts,eslint-rules}/**/*.{js,jsx,mjs}']);
  });
});
