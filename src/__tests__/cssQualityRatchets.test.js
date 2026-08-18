/**
 * Ratchets over styles.css and the worst inline-style offenders. Each
 * CEILING holds the current measured count and may only go DOWN as
 * cleanup batches land; a rise fails the suite. The spacing policy:
 * values snap to the --space-* scale {2,4,6,8,12,16,20,24}; midpoints
 * round DOWN (denser is safer in chrome); 1px stays literal only for
 * border compensation.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.join(process.cwd(), 'src/styles.css'), 'utf8');

// Measured 2026-08-17. Lower after each spacing-conversion batch.
const RAW_SPACING_CEILING = 6;

describe('spacing tokenization ratchet', () => {
  it(`raw-px spacing declarations stay at or below ${RAW_SPACING_CEILING}`, () => {
    let raw = 0;
    for (const line of css.split('\n')) {
      const m = line.match(/^\s*(?:padding|margin|gap|row-gap|column-gap|padding-[a-z]+|margin-[a-z]+):\s*([^;]+);/);
      if (!m) continue;
      if (!m[1].includes('var(') && /\dpx/.test(m[1])) raw++;
    }
    expect(raw).toBeLessThanOrEqual(RAW_SPACING_CEILING);
  });
});

describe('radius ceiling', () => {
  it('no radius exceeds the 4px contract (999px/50% pills excepted)', () => {
    const offenders = [];
    css.split('\n').forEach((line, idx) => {
      const m = line.match(/border-radius:\s*([\d.]+)px/);
      if (m && parseFloat(m[1]) > 4 && parseFloat(m[1]) < 900) {
        offenders.push(`${idx + 1}: ${line.trim()}`);
      }
    });
    expect(offenders).toEqual([]);
  });
});

describe('transition discipline', () => {
  it('no transition: all (enumerate real properties)', () => {
    expect(css.match(/transition:\s*all\b/g) ?? []).toEqual([]);
  });
});

describe('inline-style ceilings (worst offenders)', () => {
  const CEILINGS = {
    'src/ui/MapForm.jsx': 0,
    'src/ui/character-sheet-sections/display.js': 1,
    'src/ui/SetupWizard.jsx': 1,
    'src/ui/character-sheet-sections/lists.js': 0,
    'src/ui/WelcomeModals.jsx': 0,
  };
  for (const [file, ceiling] of Object.entries(CEILINGS)) {
    it(`${file} keeps inline styles at or below ${ceiling}`, () => {
      const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      const count = (src.match(/style:/g) ?? []).length;
      expect(count).toBeLessThanOrEqual(ceiling);
    });
  }
});
