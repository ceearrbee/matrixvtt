/**
 * The published repository is this tree minus the files that never
 * leave it, and the suite goes with it. Two conformance suites read
 * CLAUDE.md at module scope, so the exported tree could not run its
 * own tests: the pre-push hook failed on an ENOENT for a file the
 * export is supposed to remove.
 *
 * A test that gates a private-only file has to say so, by skipping
 * when the file is absent rather than by throwing.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Paths the clean export removes. A test may read these, but only
// behind a guard that lets the exported tree skip the assertion.
// Naming one in prose, or writing one into a temp tree, is not a read.
const PRIVATE_ONLY = ['CLAUDE.md', 'audits/', 'docs/superpowers/', '.impeccable/'];
const GUARDS = /skipIf|runIf|existsSync/;

function readsFromRepo(text, path) {
  return new RegExp(`\\b(read|readFileSync)\\s*\\([^)\\n]*['"\`]${path}`).test(text);
}

function testFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) testFiles(full, out);
    else if (/\.test\.jsx?$/.test(name)) out.push(full);
  }
  return out;
}

const ROOT = resolve(import.meta.dirname, '../..');
const files = testFiles(join(ROOT, 'src'));

describe('the suite runs in the exported tree', () => {
  it('finds the tests to check', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  for (const file of files) {
    const rel = file.slice(ROOT.length + 1);
    const text = readFileSync(file, 'utf8');
    const cited = PRIVATE_ONLY.filter((p) => readsFromRepo(text, p));
    if (cited.length === 0) continue;

    it(`${rel} guards the private-only paths it reads`, () => {
      expect(GUARDS.test(text), `reads ${cited.join(', ')} with no skip guard`).toBe(true);
    });
  }
});
