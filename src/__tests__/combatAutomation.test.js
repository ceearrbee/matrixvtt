/**
 * Combat automation settings - getCombatSettings / setCombatSetting
 *
 * Per-user toggles stored in localStorage:
 * - auto_advance_on_death: advance turn when a token reaches 0 HP
 * - auto_announce_round: post round-change announcements to chat
 * - auto_roll_npc_initiative: auto-roll initiative for NPC tokens on combat start
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getCombatSettings, setCombatSetting } from '../ui/settings-helpers.js';

beforeEach(() => {
  localStorage.clear();
});

describe('combat automation settings', () => {
  it('returns default values when nothing stored', () => {
    const s = getCombatSettings();
    expect(s.auto_advance_on_death).toBe(false);
    expect(s.auto_announce_round).toBe(true);
    expect(s.auto_roll_npc_initiative).toBe(false);
  });

  it('persists a setting change', () => {
    setCombatSetting('auto_advance_on_death', true);
    expect(getCombatSettings().auto_advance_on_death).toBe(true);
  });

  it('only changes the specified setting', () => {
    setCombatSetting('auto_announce_round', false);
    const s = getCombatSettings();
    expect(s.auto_announce_round).toBe(false);
    expect(s.auto_advance_on_death).toBe(false); // default
  });

  it('getCombatSettings returns all three keys', () => {
    const s = getCombatSettings();
    expect(Object.keys(s)).toContain('auto_advance_on_death');
    expect(Object.keys(s)).toContain('auto_announce_round');
    expect(Object.keys(s)).toContain('auto_roll_npc_initiative');
  });

  it('setCombatSetting round-trips through localStorage', () => {
    setCombatSetting('auto_roll_npc_initiative', true);
    // Simulate a fresh read
    expect(getCombatSettings().auto_roll_npc_initiative).toBe(true);
  });
});
