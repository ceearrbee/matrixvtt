/**
 * settings-marshal - strip half of the SETTINGS write/read symmetry.
 * `stripSystemConfigForWrite` removes the resolved-ruleset preset from
 * outbound writes; the read half lives in `syncer-apply.applySettings`
 * which re-derives `systemConfig` from the slug.
 */
import { describe, it, expect } from 'vitest';
import { stripSystemConfigForWrite } from '../state/settings-marshal.js';

describe('stripSystemConfigForWrite', () => {
  it('removes systemConfig while preserving every other field', () => {
    const out = stripSystemConfigForWrite({
      system: 'dnd5e',
      systemConfig: { huge: 'preset' },
      other: 1,
      nested: { a: 2 },
    });
    expect(out).toEqual({ system: 'dnd5e', other: 1, nested: { a: 2 } });
    expect('systemConfig' in out).toBe(false);
  });

  it('returns a shallow copy with the same keys when input lacks systemConfig', () => {
    const input = { system: 'fate', other: 1 };
    const out = stripSystemConfigForWrite(input);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
    expect('systemConfig' in out).toBe(false);
  });

  it('passes null and undefined through unchanged', () => {
    expect(stripSystemConfigForWrite(null)).toBeNull();
    expect(stripSystemConfigForWrite(undefined)).toBeUndefined();
  });
});
