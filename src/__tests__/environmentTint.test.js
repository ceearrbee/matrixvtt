/**
 * Pure helper mapping {weather, time_of_day} to a tint overlay.
 * No state, no I/O - renderer consumes the returned rgba string.
 */

import { describe, it, expect } from 'vitest';
import { environmentTint } from '../utils/environmentTint.js';

describe('environmentTint', () => {
  it('returns transparent for clear daytime', () => {
    expect(environmentTint({ weather: 'clear', time_of_day: 'day' }))
      .toBe('rgba(0,0,0,0)');
  });

  it('returns null/transparent for empty env', () => {
    expect(environmentTint({})).toBe('rgba(0,0,0,0)');
    expect(environmentTint(null)).toBe('rgba(0,0,0,0)');
  });

  it('night darkens with a blue tint', () => {
    expect(environmentTint({ time_of_day: 'night' }))
      .toBe('rgba(10,20,60,0.45)');
  });

  it('dusk is warm orange', () => {
    expect(environmentTint({ time_of_day: 'dusk' }))
      .toBe('rgba(200,100,30,0.25)');
  });

  it('rain adds a cool grey tint', () => {
    expect(environmentTint({ weather: 'rain', time_of_day: 'day' }))
      .toBe('rgba(80,100,120,0.25)');
  });

  it('fog whitens the scene', () => {
    expect(environmentTint({ weather: 'fog', time_of_day: 'day' }))
      .toBe('rgba(220,220,225,0.35)');
  });

  it('night + rain picks the darker night tint (weather is secondary)', () => {
    expect(environmentTint({ weather: 'rain', time_of_day: 'night' }))
      .toBe('rgba(10,20,60,0.45)');
  });

  it('accepts string presets for per-map env_tint', () => {
    expect(environmentTint('daylight')).toBe('rgba(0,0,0,0)');
    expect(environmentTint('dusk')).toBe('rgba(200,100,30,0.25)');
    expect(environmentTint('cave')).toBe('rgba(20,15,40,0.6)');
  });

  it('returns transparent for an unknown preset name', () => {
    expect(environmentTint('not-a-preset')).toBe('rgba(0,0,0,0)');
  });
});
