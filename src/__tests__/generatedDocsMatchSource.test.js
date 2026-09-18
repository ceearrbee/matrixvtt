/**
 * `docs/examples/*-ruleset.json` is generated from the ruleset presets,
 * but the committed copies were last regenerated in August and still
 * carry the pre-P14 conditions shape (`icon`, an emoji) where the
 * source now carries `abbr`. conditionsBelongToTheSystem pins the
 * source only, so a green suite said nothing about the copies, and
 * deploy.yml regenerates them into the shipped site without ever
 * comparing. The repo and the deployed docs already disagree.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { getGameSystemPresets } from '../state/rulesets.js';

const EXAMPLES = resolve(import.meta.dirname, '../../docs/examples');
const files = readdirSync(EXAMPLES).filter((f) => f.endsWith('-ruleset.json'));
const presets = getGameSystemPresets();

describe('generated ruleset examples', () => {
  it('has one file per preset and no orphans', () => {
    expect(files.sort()).toEqual(Object.keys(presets).map((k) => `${k}-ruleset.json`).sort());
  });

  it('carries the conditions shape the source carries', () => {
    for (const [key, preset] of Object.entries(presets)) {
      const written = JSON.parse(readFileSync(resolve(EXAMPLES, `${key}-ruleset.json`), 'utf8'));
      expect(written.conditions, key).toEqual(preset.conditions);
    }
  });

  it('abbreviates conditions rather than drawing them, as the source does', () => {
    for (const key of Object.keys(presets)) {
      const written = JSON.parse(readFileSync(resolve(EXAMPLES, `${key}-ruleset.json`), 'utf8'));
      for (const c of written.conditions ?? []) {
        expect(c, `${key}/${c.key}`).toHaveProperty('abbr');
        expect(c, `${key}/${c.key}`).not.toHaveProperty('icon');
      }
    }
  });
});
