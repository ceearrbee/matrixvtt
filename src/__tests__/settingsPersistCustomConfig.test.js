/**
 * updateSettings strips systemConfig only for builtin system slugs
 * (the config re-resolves from the preset at read time). Custom slugs
 * keep their inline config persisted; stripping those left imported
 * .vttruleset.json systems with no config after the next settings
 * apply, and character templates stored inside systemConfig vanished
 * the same way. Templates now live at settings.character_templates.
 */
import { describe, it, expect, vi } from 'vitest';
import { updateSettings } from '../state/writers/session-writers.js';

function makeSm(settings = {}) {
  return /** @type {any} */ ({
    settings: { gm_user_ids: ['@gm:s'], ...settings },
    powerLevels: { users: { '@gm:s': 50 } },
    widgetManager: { userId: '@gm:s' },
    yjs: { settingsMap: { set: vi.fn() } },
  });
}

describe('updateSettings systemConfig persistence', () => {
  it('strips systemConfig for builtin slugs', async () => {
    const sm = makeSm();
    await updateSettings(sm, {
      gm_user_ids: ['@gm:s'], system: 'dnd5e',
      systemConfig: { meta: { name: 'D&D 5e' } },
    });
    const written = sm.yjs.settingsMap.set.mock.calls[0][1];
    expect(written.systemConfig).toBeUndefined();
    expect(written.system).toBe('dnd5e');
  });

  it('keeps the inline systemConfig for custom slugs', async () => {
    const custom = { meta: { name: 'My Homebrew' }, attributes: [{ key: 'guts', label: 'Guts' }] };
    const sm = makeSm();
    await updateSettings(sm, {
      gm_user_ids: ['@gm:s'], system: 'custom', systemConfig: custom,
    });
    const written = sm.yjs.settingsMap.set.mock.calls[0][1];
    expect(written.systemConfig).toEqual(custom);
  });
});
