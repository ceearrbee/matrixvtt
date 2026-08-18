/**
 * The Yjs settings bridge must route through `applySettings` so the
 * preset gets resolved. Otherwise: GM saves settings (Settings.jsx
 * builds {system, systemConfig}), updateSettings() strips systemConfig
 * before writing to Yjs (correct - preset is resolved at read time
 * from `system`), Yjs delivers the stripped value back, the bridge
 * writes it directly to sm.settings → systemConfig stays undefined
 * forever. Every sheet section silently renders nothing because
 * sections come from `systemConfig.character_sheet.sections`.
 *
 * User symptom: Settings UI reports "D&D 5e" but the sheet shows only
 * the entity header + private notes - every other section is empty.
 */
import { describe, it, expect } from 'vitest';
import { applySettings } from '../state/syncer-apply.js';

describe('applySettings - preset resolution from system slug', () => {
  it('resolves systemConfig from getGameSystemPresets()[next.system] when content has only the slug', () => {
    // This is what the Yjs settings event carries - system slug only,
    // no systemConfig (updateSettings strips it before write).
    const sm = { settings: {}, activeMapId: null };
    applySettings(sm, { name: 'Room', system: 'dnd5e', grid_px: 40 });

    expect(sm.settings.system).toBe('dnd5e');
    expect(sm.settings.systemConfig, 'preset must be resolved from the slug').toBeTruthy();
    expect(sm.settings.systemConfig.character_sheet?.sections, 'character_sheet sections must be populated').toBeTruthy();
    expect(sm.settings.systemConfig.character_sheet.sections.length).toBeGreaterThan(6);
  });

  it('preserves inline systemConfig when content already has one (custom rulesets)', () => {
    const sm = { settings: {}, activeMapId: null };
    const customSystemConfig = { character_sheet: { sections: [{ kind: 'notes' }] }, attributes: [] };
    applySettings(sm, { system: 'custom', systemConfig: customSystemConfig });
    expect(sm.settings.systemConfig).toBe(customSystemConfig);
  });

  it('flags _system_missing when slug has no matching preset', () => {
    const sm = { settings: {}, activeMapId: null };
    applySettings(sm, { system: 'pathfinder' });
    expect(sm.settings.systemConfig).toBeNull();
    expect(sm.settings._system_missing).toBe('pathfinder');
  });
});

describe('initiative Yjs bridge - tombstone normalization', () => {
  // The bridge callback contract: a null / empty value must produce
  // the canonical empty shape so consumers can rely on `.order` etc.
  // Inlined helper that mirrors the bridge body.
  function normalizeInitiative(val) {
    return (val && Object.keys(val).length > 0)
      ? val
      : { active: false, round: 0, current_index: 0, order: [] };
  }

  it('null → canonical empty shape', () => {
    const out = normalizeInitiative(null);
    expect(out).toEqual({ active: false, round: 0, current_index: 0, order: [] });
    expect(out.order).toEqual([]);
  });

  it('empty object → canonical empty shape', () => {
    expect(normalizeInitiative({})).toEqual({ active: false, round: 0, current_index: 0, order: [] });
  });

  it('live initiative shape passes through unchanged', () => {
    const live = { active: true, round: 3, current_index: 1, order: [{ token_id: 't1' }] };
    expect(normalizeInitiative(live)).toBe(live);
  });
});

describe('settings Yjs bridge must call applySettings, not write the value directly', () => {
  it('a direct sm.settings = val write loses systemConfig - that\'s the bug', () => {
    const sm = { settings: {} };
    // The OLD bridge did this:
    sm.settings = { name: 'Room', system: 'dnd5e', grid_px: 40 };
    // systemConfig is undefined - this is exactly the user-reported state.
    expect(sm.settings.systemConfig).toBeUndefined();
  });

  it('routing through applySettings resolves the preset', () => {
    const sm = { settings: {}, activeMapId: null };
    // The NEW bridge does this instead:
    applySettings(sm, { name: 'Room', system: 'dnd5e', grid_px: 40 });
    expect(sm.settings.systemConfig?.character_sheet?.sections?.length).toBeGreaterThan(6);
  });
});
