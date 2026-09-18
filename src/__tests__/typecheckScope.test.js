/**
 * tsconfig excluded `**\/*.test.js` but not `**\/*.test.jsx`, so 134
 * suites were type-checked and 562 were not, and the checked half ran
 * without node types: a `.test.jsx` file reading a fixture with `fs`
 * failed while the identical `.test.js` file passed. The reflex that
 * creates is renaming the file to escape the gate, which is not a fix.
 * The suite sits outside the gate either way; this pins that it sits
 * outside it uniformly.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const tsconfig = readFileSync(resolve(import.meta.dirname, '../../tsconfig.json'), 'utf8');
const start = tsconfig.indexOf('"exclude": [') + '"exclude": ['.length;
const excluded = [...tsconfig.slice(start, tsconfig.indexOf(']', start)).matchAll(/"([^"]+)"/g)].map(
  (m) => m[1]
);

describe('typecheck scope', () => {
  it('excludes test files by both extensions, not just one', () => {
    expect(excluded).toContain('**/*.test.js');
    expect(excluded).toContain('**/*.test.jsx');
  });

  it('still checks the sources the gate exists for', () => {
    expect(excluded).not.toContain('src/**/*.js');
    expect(excluded).not.toContain('src/**/*.jsx');
  });
});
