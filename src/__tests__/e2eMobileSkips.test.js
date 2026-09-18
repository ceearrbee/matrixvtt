/**
 * Two idioms had grown for "this surface is desktop-only":
 * `testInfo.project.name === 'mobile'` and the fixture-based
 * `isMobile`. The first names one project in the matrix rather than the
 * condition it means, so it silently stops matching the moment the
 * project is renamed or a second narrow profile is added, and the spec
 * then runs on a phone and fails for the wrong reason. Keep one.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const E2E = resolve(import.meta.dirname, '../../tests/e2e');
const specs = readdirSync(E2E).filter((f) => f.endsWith('.spec.js'));

describe('e2e desktop-only skips', () => {
  it('names the condition, not one project in the matrix', () => {
    const offenders = specs.filter((f) =>
      /project\.name\s*===\s*'mobile'/.test(readFileSync(resolve(E2E, f), 'utf8'))
    );
    expect(offenders).toEqual([]);
  });

  it('every skip gives a reason', () => {
    for (const f of specs) {
      const src = readFileSync(resolve(E2E, f), 'utf8');
      for (const [call] of src.matchAll(/test\.skip\([^;]*?\);/gs)) {
        expect(call, `${f}: ${call}`).toMatch(/,\s*['"`]/);
      }
    }
  });
});
