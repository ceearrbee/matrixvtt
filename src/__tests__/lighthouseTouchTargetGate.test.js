/**
 * The touch-target assertion in lighthouserc.json was switched off while
 * targets genuinely failed; that work landed and the gate stayed blind.
 * Lighthouse 12 also renamed the audit from `tap-targets` to
 * `target-size`, so the old "off" entry named an audit that no longer
 * runs. Pin both: the current audit is asserted, the dead name is gone.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const config = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../lighthouserc.json'), 'utf8')
);
const assertions = config.ci.assert.assertions;

describe('the lighthouse job name', () => {
  it('claims only the categories that can actually fail it', () => {
    const gating = Object.entries(assertions)
      .filter(([k, v]) => k.startsWith('categories:') && Array.isArray(v) && v[0] === 'error')
      .map(([k]) => k.split(':')[1])
      .sort();
    expect(gating).toEqual(['accessibility', 'seo']);

    const ci = readFileSync(resolve(import.meta.dirname, '../../.github/workflows/ci.yml'), 'utf8');
    const name = ci.match(/^ {4}name: (Lighthouse-CI.*)$/m)?.[1] ?? '';
    expect(name).toMatch(/a11y/);
    expect(name).toMatch(/SEO/);
    // performance and best-practices are `warn`, and numberOfRuns is 1,
    // so a single noisy run must not be able to fail a deploy.
    expect(name).toMatch(/advisory/);
  });
});

describe('lighthouse touch-target gate', () => {
  it('asserts the audit Lighthouse 12 actually emits', () => {
    expect(assertions['target-size']).toBe('error');
  });

  it('no longer names the audit Lighthouse 12 removed', () => {
    expect(assertions).not.toHaveProperty('tap-targets');
  });

  it('turns nothing else off without saying why', () => {
    const silentlyOff = Object.entries(assertions)
      .filter(([, value]) => value === 'off')
      .map(([audit]) => audit);
    expect(silentlyOff).toEqual([
      'is-on-https',
      'redirects-http',
      'uses-text-compression',
      'uses-http2',
      'uses-long-cache-ttl',
      'csp-xss',
      'errors-in-console',
      'image-aspect-ratio',
    ]);
  });
});
