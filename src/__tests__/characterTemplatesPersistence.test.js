/**
 * Character templates persist at settings.character_templates.
 * updateSettings strips systemConfig for builtin systems, so anything
 * stored inside it (the old template location) vanished on the next
 * settings apply. Reads fall back to the legacy systemConfig location
 * for rooms holding old inline data.
 */
import { describe, it, expect } from 'vitest';
import {
  getCharacterTemplates,
  addTemplateToSettings,
  removeTemplateFromSettings,
} from '../ui/character-templates.js';

const TPL = { name: 'Skirmisher', attributes: { dexterity: 14 } };

describe('getCharacterTemplates', () => {
  it('reads the top-level key', () => {
    expect(getCharacterTemplates({ character_templates: [TPL] })).toEqual([TPL]);
  });

  it('falls back to the legacy systemConfig location', () => {
    expect(getCharacterTemplates({ systemConfig: { character_templates: [TPL] } })).toEqual([TPL]);
  });

  it('prefers the top-level key over the legacy one', () => {
    const settings = {
      character_templates: [TPL],
      systemConfig: { character_templates: [{ name: 'stale' }] },
    };
    expect(getCharacterTemplates(settings)).toEqual([TPL]);
  });

  it('returns [] for empty settings', () => {
    expect(getCharacterTemplates({})).toEqual([]);
    expect(getCharacterTemplates(undefined)).toEqual([]);
  });
});

describe('addTemplateToSettings', () => {
  it('appends at the top level and leaves systemConfig alone', () => {
    const settings = { name: 'Table', system: 'dnd5e', systemConfig: { meta: { name: 'D&D 5e' } } };
    const next = addTemplateToSettings(settings, TPL);
    expect(next.character_templates).toEqual([TPL]);
    expect(next.systemConfig).toBe(settings.systemConfig);
  });

  it('carries legacy inline templates forward into the new key', () => {
    const legacy = { name: 'old' };
    const settings = { systemConfig: { character_templates: [legacy] } };
    const next = addTemplateToSettings(settings, TPL);
    expect(next.character_templates).toEqual([legacy, TPL]);
  });
});

describe('removeTemplateFromSettings', () => {
  it('removes by index from wherever the templates live', () => {
    const settings = { character_templates: [TPL, { name: 'other' }] };
    const next = removeTemplateFromSettings(settings, 0);
    expect(next.character_templates).toEqual([{ name: 'other' }]);
  });
});
