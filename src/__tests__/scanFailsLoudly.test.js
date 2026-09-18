/**
 * Every scan in scan-bad-patterns.sh ran `grep ... 2>/dev/null || true`.
 * grep exits 1 for "no match" and 2 or more for a real error, so a
 * renamed directory or a malformed pattern reported clean. A gate that
 * cannot fail is the thing this repo keeps rediscovering.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

const SCRIPT = resolve(import.meta.dirname, '../../scripts/scan-bad-patterns.sh');

function runIn(root) {
  try {
    execFileSync('bash', [join(root, 'scripts', 'scan-bad-patterns.sh')], { encoding: 'utf8' });
    return { code: 0, out: '' };
  } catch (e) {
    return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('scan-bad-patterns.sh', () => {
  it('refuses to report clean when the tree it scans is not there', () => {
    const root = mkdtempSync(join(tmpdir(), 'scan-gate-'));
    try {
      mkdirSync(join(root, 'scripts'));
      copyFileSync(SCRIPT, join(root, 'scripts', 'scan-bad-patterns.sh'));
      const { code, out } = runIn(root);
      expect(out).not.toMatch(/scan-bad-patterns: clean/);
      expect(code).not.toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('still passes on the real tree', () => {
    expect(runIn(resolve(import.meta.dirname, '../../')).code).toBe(0);
  });
});
