/**
 * Pure helpers of scripts/check-version-bump.mjs. The fetch itself runs
 * in CI against the live site; these pin the decision so the gate can't
 * quietly become a yes-machine and let an unbumped deploy through.
 */
import { describe, it, expect } from 'vitest';
import { parseLiveVersion, decideVersionBump } from '../../scripts/check-version-bump.mjs';

describe('parseLiveVersion', () => {
  it('reads the version out of a health.json body', () => {
    expect(parseLiveVersion('{"status":"ok","version":"1.1.0"}')).toBe('1.1.0');
  });

  it('returns null when the body has no version', () => {
    expect(parseLiveVersion('{"status":"ok"}')).toBe(null);
  });

  it('returns null when the body is not JSON', () => {
    expect(parseLiveVersion('<!doctype html><title>404</title>')).toBe(null);
    expect(parseLiveVersion('')).toBe(null);
  });
});

describe('decideVersionBump', () => {
  it('blocks a build whose version is already live', () => {
    const verdict = decideVersionBump({ liveVersion: '1.1.0', builtVersion: '1.1.0' });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/1\.1\.0/);
  });

  it('passes a build that bumps past the live version', () => {
    expect(decideVersionBump({ liveVersion: '1.1.0', builtVersion: '1.2.0' }).ok).toBe(true);
  });

  it('passes when nothing is live yet', () => {
    const verdict = decideVersionBump({ liveVersion: null, builtVersion: '1.1.0' });
    expect(verdict.ok).toBe(true);
    expect(verdict.reason).toMatch(/no live/i);
  });
});
