/**
 * A broken e2e run used to cost more than a working one: every failing
 * spec spent its full 30s timeout, twice with the CI retry, and one run
 * ground on for 74 minutes to tell us what the first few failures had
 * already said. Capping failures ends a doomed run early without
 * touching a green one, and the job timeouts stop a genuine hang from
 * reaching the 360-minute default.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel) => readFileSync(resolve(import.meta.dirname, '../../', rel), 'utf8');

describe('playwright.config.js', () => {
  it('stops a run that is already failing', () => {
    expect(read('playwright.config.js')).toMatch(/maxFailures:\s*process\.env\.CI\s*\?\s*\d+\s*:\s*0/);
  });
});

describe('workflow job budgets', () => {
  for (const wf of ['.github/workflows/ci.yml', '.github/workflows/deploy.yml']) {
    it(`${wf} gives every job a timeout`, () => {
      const text = read(wf).slice(read(wf).indexOf('\njobs:'));
      const jobs = [...text.matchAll(/^ {2}([a-z][\w-]*):$/gm)].map((m) => m[1]);
      expect(jobs.length).toBeGreaterThan(0);
      expect([...text.matchAll(/^ {4}timeout-minutes: \d+$/gm)]).toHaveLength(jobs.length);
    });
  }
});
