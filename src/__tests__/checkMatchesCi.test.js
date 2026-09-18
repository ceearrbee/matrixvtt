/**
 * `npm run check` ran three of the nine gates in CI's check job, so the
 * command CLAUDE.md points at could sit green while the merge gate was
 * red. It did, for the bundle-size and dead-code gates at once.
 *
 * deploy.yml then ran a third, weaker list of its own: no knip, no
 * pattern scan, and plain `npm test`, which applies no coverage floors.
 * That is the workflow that actually ships, and nothing read it. Both
 * workflows are pinned here now.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const path = (rel) => resolve(import.meta.dirname, '../../', rel);
const read = (rel) => readFileSync(path(rel), 'utf8');
// The clean export drops CLAUDE.md, so the exported tree skips the
// block that gates it rather than failing to open it.
const hasClaude = existsSync(path('CLAUDE.md'));

/**
 * The `run:` commands of one job, in order, minus the install step.
 * Bounded by the next job key rather than a named sibling, so renaming
 * or reordering jobs cannot silently empty the list.
 */
function gatesOf(workflowText, jobName) {
  const start = workflowText.indexOf(`\n  ${jobName}:`);
  expect(start, `job ${jobName} not found`).toBeGreaterThan(-1);
  const rest = workflowText.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[a-z][\w-]*:\n/);
  const job = next === -1 ? rest : rest.slice(0, next + 1);
  expect(job).not.toMatch(/^ {8}run: \|/m);
  return [...job.matchAll(/^ {8}run: (.+)$/gm)].map((m) => m[1]).filter((c) => c !== 'npm ci');
}

const ci = read('.github/workflows/ci.yml');
const deploy = read('.github/workflows/deploy.yml');
const scripts = JSON.parse(read('package.json')).scripts;

describe('npm run check:ci', () => {
  it('runs every gate the CI check job runs, in the same order', () => {
    const gates = gatesOf(ci, 'check');
    expect(gates.length).toBe(10);
    expect(scripts['check:ci'].split(' && ')).toEqual(gates);
  });

  it('keeps check as the fast inner loop it already was', () => {
    expect(scripts.check).toBe('npm run lint && npm run typecheck && npm run test');
  });
});

describe('the deploy workflow', () => {
  it('gates on check:ci rather than a hand-copied weaker list', () => {
    expect(gatesOf(deploy, 'build')).toEqual([
      'node scripts/check-version-bump.mjs',
      'npm run check:ci',
      'npm run docs:build',
    ]);
  });

  it('skips every job when Pages is off, as its own preflight promises', () => {
    // The probe exists "so build + deploy can skip cleanly" where Pages
    // is disabled, but the condition was only ever on deploy. build ran
    // anyway and failed the version-bump gate, turning every green CI
    // into a red deploy on a repo that cannot deploy.
    const jobsBlock = deploy.slice(deploy.indexOf('\njobs:'));
    const gated = [...jobsBlock.matchAll(/^ {2}([a-z][\w-]*):$/gm)]
      .map((m) => m[1])
      .filter((job) => job !== 'preflight');
    expect(gated).toEqual(['build', 'deploy']);
    for (const job of gated) {
      const start = jobsBlock.indexOf(`\n  ${job}:`);
      const body = jobsBlock.slice(start, start + 400);
      expect(body, job).toMatch(/needs\.preflight\.outputs\.pages_enabled == 'true'/);
    }
  });

  it('never reaches for a gate check:ci does not already carry', () => {
    const deployOnly = gatesOf(deploy, 'build').filter((c) => c !== 'npm run check:ci');
    const inCheckCi = scripts['check:ci'].split(' && ');
    for (const cmd of deployOnly) expect(inCheckCi).not.toContain(cmd);
  });
});

describe.skipIf(!hasClaude)('CLAUDE.md', () => {
  it('points the before-claiming-done sentence at the full list', () => {
    const row = read('CLAUDE.md')
      .split('\n')
      .find((line) => line.includes('before claiming done'));
    expect(row).toContain('`npm run check:ci`');
  });
});

describe('docs/RELEASE-CHECKLIST.md', () => {
  it('names the command that covers the gates, not the inner loop', () => {
    const checklist = read('docs/RELEASE-CHECKLIST.md');
    expect(checklist).toContain('npm run check:ci');
    expect(checklist).not.toMatch(/^npm run check$/m);
  });
});
