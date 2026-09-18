/**
 * A setting that nothing reads is a control that lies to the user.
 *
 * Every key in the combat-automation defaults must be read somewhere
 * outside the module that declares it and the panel that renders its
 * checkbox. Four of the original five keys had no reader at all, so
 * the panel offered the GM toggles that could not change anything.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { COMBAT_DEFAULTS } from '../utils/combat-settings.js';

const SRC = join(process.cwd(), 'src');
const DECLARING = ['utils/combat-settings.js'];
const RENDERING = ['ui/CombatAutomationPanel.jsx'];

function sourceFiles(dir = SRC, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__') continue;
      sourceFiles(full, out);
    } else if (/\.jsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe('every combat-automation setting has a reader', () => {
  const files = sourceFiles();
  const excluded = [...DECLARING, ...RENDERING].map((p) => join(SRC, p));

  for (const key of Object.keys(COMBAT_DEFAULTS)) {
    it(`${key} is read outside its declaration and its checkbox`, () => {
      const readers = files
        .filter((f) => !excluded.includes(f))
        .filter((f) => readFileSync(f, 'utf8').includes(key))
        .map((f) => f.slice(SRC.length + 1));
      expect(readers, `${key} has no reader; wire it or delete it`).not.toHaveLength(0);
    });
  }
});

describe('retired settings stay retired', () => {
  const files = sourceFiles();

  for (const key of ['auto_advance_on_death', 'auto_roll_npc_initiative']) {
    it(`${key} is gone from the tree`, () => {
      const hits = files
        .filter((f) => readFileSync(f, 'utf8').includes(key))
        .map((f) => f.slice(SRC.length + 1));
      expect(hits, `${key} was deleted as unreadable; do not reintroduce it`).toEqual([]);
    });
  }
});
