/**
 * Type floor + touch targets. DESIGN.md sets --font-size-xs (12px) as
 * the smallest chrome type; the stylesheet had 65 declarations below
 * it, down to 8px, including the interactive .ie__set-turn at 9px.
 * The one documented exception: the 20px avatar's decorative monogram,
 * whose accessible name lives elsewhere and cannot fit 12px glyphs.
 *
 * Touch targets: the coarse-pointer sweep must cover the sheet
 * navigation and initiative controls, not just the toolbar.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.join(process.cwd(), 'src/styles.css'), 'utf8');

const ALLOWLIST = [/avatar__monogram/];

function subFloorDeclarations() {
  const offenders = [];
  css.split('\n').forEach((line, idx) => {
    const m = line.match(/font-size:\s*([\d.]+)(px|rem|pt)\b/);
    if (!m) return;
    if (ALLOWLIST.some((re) => re.test(line))) return;
    const value = parseFloat(m[1]);
    const px = m[2] === 'px' ? value : m[2] === 'rem' ? value * 16 : value * (96 / 72);
    if (px < 12) offenders.push(`${idx + 1}: ${line.trim()}`);
  });
  return offenders;
}

describe('type floor', () => {
  it('no chrome type resolves below 12px (allowlist: 20px avatar monogram)', () => {
    expect(subFloorDeclarations()).toEqual([]);
  });

  it('the retired --font-size-2xs token stays unreferenced', () => {
    expect(css).not.toContain('var(--font-size-2xs');
  });

  it('.dbt--sm and .dbt--compact take their type from the scale, exactly once', () => {
    const rules = [...css.matchAll(/^([^@{}]+)\{([^}]*)\}/gm)]
      .filter((m) => /\.dbt--(sm|compact)[,\s{]?/.test(m[1]) && !m[1].includes(':'));
    const withFont = rules.filter((m) => m[2].includes('font-size'));
    expect(withFont).toHaveLength(1);
    expect(withFont[0][2]).toContain('var(--font-size-xs)');
  });
});

describe('coarse-pointer touch targets', () => {
  it('the 44px sweep covers sheet navigation and initiative controls', () => {
    const sweepStart = css.indexOf('Ensure touch targets meet WCAG');
    expect(sweepStart).toBeGreaterThan(-1);
    const block = css.slice(sweepStart, css.indexOf('}', css.indexOf('{', sweepStart)));
    for (const sel of ['.ctab', '.ctabs--sub .ctab', '.chip', '.ie__set-turn', '.ie__hp-adjust-btn']) {
      expect(block, `44px sweep is missing ${sel}`).toContain(sel);
    }
  });
});
