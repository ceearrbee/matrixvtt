/**
 * Settings events arrive with systemConfig stripped (it resolves from
 * the slug at read time), so applySettings must re-resolve the preset
 * on a slug change instead of letting the previous system's config
 * survive the merge. saveSettings must merge over current settings so
 * fields outside the form (active_map_id) survive a save; losing the
 * pointer drops players onto the "first map" fallback.
 */
import { describe, it, expect, vi } from 'vitest';
import { applySettings } from '../state/syncer-apply.js';
import { createSettingsOps } from '../ui/capabilities/settings-ops.js';

function makeSm(settings) {
  return { settings, maps: new Map(), activeMapId: null };
}

describe('applySettings system switching', () => {
  it('re-resolves the preset when the system slug changes without an inline config', () => {
    const sm = makeSm({ system: 'dnd5e', systemConfig: { meta: { name: 'D&D 5e' } } });
    applySettings(sm, { system: 'risus', name: 'Table' });
    expect(sm.settings.system).toBe('risus');
    expect(sm.settings.systemConfig?.meta?.name).toMatch(/risus/i);
  });

  it('keeps an inline systemConfig from the event verbatim (custom rulesets)', () => {
    const custom = { meta: { name: 'My Homebrew' }, character_sheet: { sections: [] } };
    const sm = makeSm({ system: 'dnd5e', systemConfig: { meta: { name: 'D&D 5e' } } });
    applySettings(sm, { system: 'homebrew', systemConfig: custom });
    expect(sm.settings.systemConfig).toBe(custom);
  });

  it('keeps the existing config when the slug is unchanged', () => {
    const current = { meta: { name: 'D&D 5e' } };
    const sm = makeSm({ system: 'dnd5e', systemConfig: current });
    applySettings(sm, { system: 'dnd5e', name: 'Renamed' });
    expect(sm.settings.systemConfig).toBe(current);
  });
});

describe('saveSettings preserves fields outside the form', () => {
  it('merges over current settings so active_map_id survives a save', async () => {
    const updateSettings = vi.fn().mockResolvedValue(undefined);
    const ui = {
      state: {
        settings: { name: 'Old', system: 'dnd5e', active_map_id: 'map-7', grid_px: 40 },
        updateSettings,
      },
      _syncDisplayName: vi.fn(),
    };
    const ops = createSettingsOps(ui);
    await ops.saveSettings({ settings: { name: 'New', system: 'risus', grid_px: 50 } });
    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New', system: 'risus', grid_px: 50, active_map_id: 'map-7' }),
    );
  });
});
