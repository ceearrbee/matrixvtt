/**
 * Silent .catch(() => {}) at Matrix-write boundaries swallows 429s,
 * permission rejections, and validation failures with no user feedback.
 * The master-readiness plan (sub-project F) calls these sites out
 * explicitly; this test pins them so they don't regress.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const FILES = [
  'ui/combat/turn-flow.js',
  'ui/gm/panels/EnvironmentPanel.jsx',
  'map/input/token-drag.js',
  'map/input/tools.js',
];

describe('no silent .catch(() => {}) at write boundaries', () => {
  for (const rel of FILES) {
    it(rel, () => {
      const src = readFileSync(resolve(root, rel), 'utf8');
      const match = src.match(/\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/);
      expect(match, `${rel} still has \`.catch(() => {})\``).toBeNull();
    });
  }
});
