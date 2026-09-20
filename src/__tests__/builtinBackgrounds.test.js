/**
 * Built-in terrain tile URLs. Same shape as builtin-icons.js: the site
 * lives under a project-page subpath, so every URL goes through
 * Vite's BASE_URL rather than a leading slash.
 */
import { describe, it, expect } from 'vitest';
import { builtinTileUrl, isBuiltinTileUrl } from '../utils/builtin-backgrounds.js';

describe('builtinTileUrl', () => {
  it('builds a base-prefixed webp path', () => {
    expect(builtinTileUrl('stone-floor', '/matrixvtt/')).toBe('/matrixvtt/backgrounds/tiles/stone-floor.webp');
  });

  it('normalises a base with no trailing slash, and an empty one', () => {
    expect(builtinTileUrl('cobble', '/matrixvtt')).toBe('/matrixvtt/backgrounds/tiles/cobble.webp');
    expect(builtinTileUrl('cobble', '')).toBe('/backgrounds/tiles/cobble.webp');
  });
});

describe('isBuiltinTileUrl', () => {
  it('recognises our own tile paths', () => {
    expect(isBuiltinTileUrl('/matrixvtt/backgrounds/tiles/stone-floor.webp')).toBe(true);
    expect(isBuiltinTileUrl('backgrounds/tiles/stone-floor.webp')).toBe(true);
  });

  it('rejects anything that needs resolving or is not ours', () => {
    expect(isBuiltinTileUrl('mxc://hs/abc')).toBe(false);
    expect(isBuiltinTileUrl('https://evil.example/backgrounds/tiles/x.webp')).toBe(false);
    expect(isBuiltinTileUrl('/matrixvtt/icons/dark/lorc/sword.svg')).toBe(false);
    expect(isBuiltinTileUrl('')).toBe(false);
    expect(isBuiltinTileUrl(null)).toBe(false);
  });
});
