/**
 * CLAUDE.md said "Prettier enforces" while 1,004 files failed
 * `prettier --check` and nothing ran it, and package.json carried a
 * `knip:prod` gate whose only mention in the repo was its own
 * definition. A command the docs name must exist, and a claim the docs
 * make about enforcement must be one something actually enforces.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const path = (rel) => resolve(import.meta.dirname, '../../', rel);
const read = (rel) => readFileSync(path(rel), 'utf8');
// CLAUDE.md never leaves this repository, so the exported tree runs
// this file without it. Everything below package.json still applies.
const hasClaude = existsSync(path('CLAUDE.md'));
const claude = hasClaude ? read('CLAUDE.md') : '';
const scripts = JSON.parse(read('package.json')).scripts;

describe.skipIf(!hasClaude)('CLAUDE.md', () => {
  it('names only npm scripts that exist', () => {
    const named = [...claude.matchAll(/`npm run ([a-z][\w:-]*)`/g)].map((m) => m[1]);
    expect(named.length).toBeGreaterThan(0);
    expect([...new Set(named)].filter((s) => !(s in scripts))).toEqual([]);
  });

  it('does not claim Prettier enforces anything, because no gate runs it', () => {
    const gated = [scripts['check:ci'], read('.husky/pre-commit'), read('.github/workflows/ci.yml')].join('\n');
    expect(gated).not.toMatch(/format:check/);
    expect(claude).not.toMatch(/Prettier enforces/);
  });
});

describe('package.json', () => {
  it('carries no knip config that nothing runs', () => {
    expect(scripts).not.toHaveProperty('knip:prod');
  });
});
