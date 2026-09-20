/**
 * Material palettes for generated maps: which bundled tile paints each
 * terrain code, and the flat colour to use when the tile has not
 * decoded yet or the GM chose the plain line style.
 *
 * These are map materials, not app chrome, so they do not come from the
 * theme tokens. They live here rather than inline at the call site for
 * the same reason every other constant in this repo does.
 */

import { TERRAIN } from './terrain.js';

function palette(id, label, tiles, colors) {
  return Object.freeze({ id, label, tiles: Object.freeze(tiles), colors: Object.freeze(colors) });
}

export const PALETTES = Object.freeze({
  dungeon: palette('dungeon', 'Dungeon stone',
    { [TERRAIN.FLOOR]: 'stone-floor', [TERRAIN.ROUGH]: 'cobble', [TERRAIN.WATER]: 'ice' },
    { [TERRAIN.FLOOR]: '#3b3f47', [TERRAIN.WALL]: '#16171b', [TERRAIN.ROUGH]: '#4a4e55', [TERRAIN.WATER]: '#2c4a55', [TERRAIN.VOID]: '#101115' }),

  crypt: palette('crypt', 'Crypt tile',
    { [TERRAIN.FLOOR]: 'tiled-floor', [TERRAIN.ROUGH]: 'marble', [TERRAIN.WATER]: 'ice' },
    { [TERRAIN.FLOOR]: '#575047', [TERRAIN.WALL]: '#17151a', [TERRAIN.ROUGH]: '#6b6459', [TERRAIN.WATER]: '#33505a', [TERRAIN.VOID]: '#101015' }),

  cavern: palette('cavern', 'Damp cavern',
    { [TERRAIN.FLOOR]: 'dirt', [TERRAIN.ROUGH]: 'gravel', [TERRAIN.WATER]: 'ice' },
    { [TERRAIN.FLOOR]: '#4a3a33', [TERRAIN.WALL]: '#1c1512', [TERRAIN.ROUGH]: '#5a4a40', [TERRAIN.WATER]: '#2a4650', [TERRAIN.VOID]: '#120d0b' }),

  forest: palette('forest', 'Forest floor',
    { [TERRAIN.FLOOR]: 'forest-floor', [TERRAIN.ROUGH]: 'moss', [TERRAIN.WATER]: 'ice' },
    { [TERRAIN.FLOOR]: '#3f4a30', [TERRAIN.WALL]: '#1a2216', [TERRAIN.ROUGH]: '#4c5a38', [TERRAIN.WATER]: '#2c4a4a', [TERRAIN.VOID]: '#101509' }),

  desert: palette('desert', 'Desert sand',
    { [TERRAIN.FLOOR]: 'sand', [TERRAIN.ROUGH]: 'gravel', [TERRAIN.WATER]: 'ice' },
    { [TERRAIN.FLOOR]: '#9a8a68', [TERRAIN.WALL]: '#3a2f1f', [TERRAIN.ROUGH]: '#877a5c', [TERRAIN.WATER]: '#3f6a70', [TERRAIN.VOID]: '#241d13' }),

  frozen: palette('frozen', 'Frozen waste',
    { [TERRAIN.FLOOR]: 'snow', [TERRAIN.ROUGH]: 'gravel', [TERRAIN.WATER]: 'ice' },
    { [TERRAIN.FLOOR]: '#b9c2c8', [TERRAIN.WALL]: '#2b3a44', [TERRAIN.ROUGH]: '#8d979d', [TERRAIN.WATER]: '#3d6470', [TERRAIN.VOID]: '#1b252b' }),
});

export const DEFAULT_PALETTE = 'dungeon';

export function resolvePalette(id) {
  return PALETTES[id] ?? PALETTES[DEFAULT_PALETTE];
}
