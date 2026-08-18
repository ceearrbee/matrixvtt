/**
 * map-strip-size.js - per-(user, room) localStorage stamp for the
 * conversation-first map-strip height. Clamp band, codec, and
 * cross-tab subscription contract.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  clampMapStripSize,
  readMapStripSize,
  writeMapStripSize,
} from '../utils/map-strip-size.js';

beforeEach(() => {
  localStorage.clear();
  // Pin viewport so tests don't depend on the test environment's
  // ambient innerHeight. 1000px → 60vh cap = 600px.
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(1000);
});

describe('clampMapStripSize', () => {
  it('returns null for non-numeric / nullish inputs', () => {
    expect(clampMapStripSize(null)).toBeNull();
    expect(clampMapStripSize(undefined)).toBeNull();
    expect(clampMapStripSize(Number.NaN)).toBeNull();
    expect(clampMapStripSize(Infinity)).toBeNull();
  });

  it('passes 0 through as the collapsed sentinel', () => {
    expect(clampMapStripSize(0)).toBe(0);
  });

  it('treats negatives as collapsed (0)', () => {
    expect(clampMapStripSize(-40)).toBe(0);
  });

  it('snaps anything in (0, MIN_PX) up to MIN_PX', () => {
    expect(clampMapStripSize(1)).toBe(80);
    expect(clampMapStripSize(79)).toBe(80);
  });

  it('passes a value inside the band through', () => {
    expect(clampMapStripSize(240)).toBe(240);
  });

  it('caps at viewport*0.6', () => {
    expect(clampMapStripSize(9999)).toBe(600);
  });

  it('rounds fractional values', () => {
    expect(clampMapStripSize(240.7)).toBe(241);
  });
});

describe('map-strip-size stamp', () => {
  it('writes and reads back a clamped px value', () => {
    writeMapStripSize('@u:s', '!r:s', 240);
    expect(readMapStripSize('@u:s', '!r:s')).toBe(240);
  });

  it('returns null when no stamp exists', () => {
    expect(readMapStripSize('@u:s', '!r:s')).toBeNull();
  });

  it('returns null for an invalid stored value (defence against drift)', () => {
    localStorage.setItem('vtt-map-strip:@u:s:!r:s', 'pancakes');
    expect(readMapStripSize('@u:s', '!r:s')).toBeNull();
  });

  it('clamps oversize writes to the viewport cap', () => {
    writeMapStripSize('@u:s', '!r:s', 9999);
    expect(localStorage.getItem('vtt-map-strip:@u:s:!r:s')).toBe('600');
  });

  it('clamps small writes up to MIN_PX (collapsed sentinel excluded)', () => {
    writeMapStripSize('@u:s', '!r:s', 20);
    expect(readMapStripSize('@u:s', '!r:s')).toBe(80);
  });

  it('writes 0 verbatim for the collapsed state', () => {
    writeMapStripSize('@u:s', '!r:s', 0);
    expect(readMapStripSize('@u:s', '!r:s')).toBe(0);
  });

  it('refuses to write when userId or roomId is missing', () => {
    writeMapStripSize(null, '!r:s', 240);
    writeMapStripSize('@u:s', null, 240);
    expect(localStorage.length).toBe(0);
  });

  it('is scoped per (user, room)', () => {
    writeMapStripSize('@gm:s', '!a:s', 240);
    writeMapStripSize('@gm:s', '!b:s', 360);
    writeMapStripSize('@player:s', '!a:s', 120);
    expect(readMapStripSize('@gm:s', '!a:s')).toBe(240);
    expect(readMapStripSize('@gm:s', '!b:s')).toBe(360);
    expect(readMapStripSize('@player:s', '!a:s')).toBe(120);
  });
});
