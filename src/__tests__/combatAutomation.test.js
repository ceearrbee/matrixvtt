/**
 * Combat automation settings - getCombatSettings / setCombatSetting
 *
 * Per-browser toggles. Only keys something actually reads live here:
 * - auto_announce_round: post round-change announcements to chat
 * - auto_reveal_fog: open fog around a moving token that has sight
 * - default_vision_radius: the sight radius a new token starts with
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getCombatSettings, setCombatSetting, COMBAT_DEFAULTS } from '../utils/combat-settings.js';

beforeEach(() => {
  localStorage.clear();
});

describe('combat automation settings', () => {
  it('returns default values when nothing stored', () => {
    const s = getCombatSettings();
    expect(s.auto_announce_round).toBe(true);
    expect(s.auto_reveal_fog).toBe(true);
    expect(s.default_vision_radius).toBe(30);
  });

  it('persists a setting change', () => {
    setCombatSetting('auto_reveal_fog', false);
    expect(getCombatSettings().auto_reveal_fog).toBe(false);
  });

  it('only changes the specified setting', () => {
    setCombatSetting('auto_announce_round', false);
    const s = getCombatSettings();
    expect(s.auto_announce_round).toBe(false);
    expect(s.auto_reveal_fog).toBe(true);
  });

  it('returns every declared key', () => {
    expect(Object.keys(getCombatSettings()).sort()).toEqual(Object.keys(COMBAT_DEFAULTS).sort());
  });

  it('round-trips a numeric setting through localStorage', () => {
    setCombatSetting('default_vision_radius', 60);
    expect(getCombatSettings().default_vision_radius).toBe(60);
  });

  it('survives unreadable stored JSON', () => {
    localStorage.setItem('vtt:combat-automation', 'not json');
    expect(getCombatSettings()).toEqual(COMBAT_DEFAULTS);
  });
});
