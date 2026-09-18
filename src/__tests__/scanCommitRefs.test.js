/**
 * The public repository is an orphan branch: each release is one
 * hand-written commit carrying a tree, so no hash from this repository
 * resolves there. A doc that cites `acb15c0` therefore points at
 * nothing for every reader outside this tree, and it advertises a
 * history the published repo does not have.
 *
 * CLAUDE.md, audits/ and docs/superpowers/ never ship, so they cite
 * hashes freely.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

const SCRIPT = resolve(import.meta.dirname, '../../scripts/scan-bad-patterns.sh');

function runOn(docContents) {
  const root = mkdtempSync(join(tmpdir(), 'scan-commit-'));
  try {
    for (const dir of ['scripts', 'src', 'docs', '.github']) mkdirSync(join(root, dir));
    copyFileSync(SCRIPT, join(root, 'scripts', 'scan-bad-patterns.sh'));
    for (const [name, body] of Object.entries(docContents)) {
      writeFileSync(join(root, name), body);
    }
    try {
      const out = execFileSync('bash', [join(root, 'scripts', 'scan-bad-patterns.sh')], { encoding: 'utf8' });
      return { code: 0, out };
    } catch (e) {
      return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('published docs cite no commit hash', () => {
  it('fails on a backticked hash in docs/', () => {
    const { code, out } = runOn({ 'docs/BUNDLE-POLICY.md': 'Commit `acb15c0` converted the runtime.\n' });
    expect(out).toMatch(/commit hash/i);
    expect(code).not.toBe(0);
  });

  it('fails on a hash in a root readme', () => {
    const { code, out } = runOn({ 'README.md': 'Fixed in commit 1a2b3c4d.\n' });
    expect(out).toMatch(/commit hash/i);
    expect(code).not.toBe(0);
  });

  it('passes on prose that only looks hex-ish', () => {
    const { code } = runOn({
      'docs/tokens.md': 'The accent is `#2f6fd0`, the scale starts at `--z-panel`.\n'
        + 'An export stamps `"exported_at": 1718630400000`.\n',
    });
    expect(code).toBe(0);
  });

  it('leaves the private docs alone', () => {
    const { code } = runOn({ 'CLAUDE.md': 'Recent commits (`19aeb9f`, `b5f18fc`) tamed this.\n' });
    expect(code).toBe(0);
  });
});
