/**
 * Static scan: design-token conformance (DESIGN.md contract).
 *
 *  - The accent and page-kind tokens must be real theme tokens, not
 *    per-use-site fallback hex (a fallback renders theme-blind).
 *  - Status hexes (#1D9E75 green / #E24B4A red) must not be hardcoded
 *    in styles.css - they belong to the theme files only.
 *  - Focus rings are never removed without a :focus-visible
 *    replacement (WCAG 2.4.7): page-drawer + wikilinks carry the
 *    2px var(--color-focus) ring.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(resolve(here, rel), 'utf8');

const styles = read('../styles.css');
const dark = read('../themes/dark.css');
const light = read('../themes/light.css');
const highContrast = read('../themes/high-contrast.css');
const nondescript = read('../themes/nondescript.css');

describe('design-token conformance', () => {
  it('defines --color-accent and the four --color-kind-* tokens in the theme fallback (dark.css)', () => {
    for (const token of [
      '--color-accent:',
      '--color-kind-journal:',
      '--color-kind-lore:',
      '--color-kind-fiction:',
      '--color-kind-prep:',
    ]) {
      expect(dark, `dark.css missing ${token}`).toContain(token);
    }
  });

  it('overrides the literal fiction hue per theme (the others alias semantic tokens)', () => {
    expect(light).toContain('--color-kind-fiction:');
    expect(highContrast).toContain('--color-kind-fiction:');
    expect(nondescript).toContain('--color-kind-fiction:');
  });

  it('has no hex fallbacks on accent/kind token uses in styles.css', () => {
    expect(styles).not.toMatch(/var\(--color-accent\s*,\s*#/);
    expect(styles).not.toMatch(/var\(--color-kind-[a-z]+\s*,/);
  });

  it('does not hardcode status hexes in styles.css (theme files own them)', () => {
    expect(styles).not.toMatch(/#1D9E75/i);
    expect(styles).not.toMatch(/#E24B4A/i);
    expect(styles).not.toMatch(/#4a90e2/i);
    expect(styles).not.toMatch(/#4a9eff/i);
  });

  it('does not hardcode the literal color white (use --color-text-inverse so light/HC themes track)', () => {
    expect(styles).not.toMatch(/color:\s*white\b/i);
  });

  it('styles map list items with a hairline border, not a heavy 2px one', () => {
    const block = styles.match(/\.map-list-item\s*\{[^}]*\}/);
    expect(block, '.map-list-item rule not found').not.toBeNull();
    expect(block[0]).not.toMatch(/border:\s*2px/);
    expect(block[0]).toMatch(/border:\s*0\.5px/);
  });

  it('marks the selected map list item with the canonical accent border token', () => {
    const block = styles.match(/\.map-list-item--selected\s*\{[^}]*\}/);
    expect(block, '.map-list-item--selected rule not found').not.toBeNull();
    expect(block[0]).toMatch(/border-color:\s*var\(--color-border-info\)/);
  });

  it('gives the shared clickable card a :focus-visible ring (WCAG 2.4.7)', () => {
    expect(styles).toMatch(
      /\.card:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-focus\)/
    );
  });

  it('page-drawer and wikilinks keep a :focus-visible ring', () => {
    const ring = (selector) => {
      const re = new RegExp(
        `${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:focus-visible\\s*\\{[^}]*outline:\\s*2px solid var\\(--color-focus\\)`,
      );
      return re.test(styles);
    };
    expect(ring('.page-drawer'), '.page-drawer lacks a :focus-visible ring').toBe(true);
    expect(ring('.wikilink--preview'), '.wikilink--preview lacks a :focus-visible ring').toBe(true);
    expect(ring('.wikilink--roll'), '.wikilink--roll lacks a :focus-visible ring').toBe(true);
  });
});

describe('token resolution', () => {
  it('every referenced --color/--font/--space/--border-radius token is defined', () => {
    const { readdirSync, statSync } = require('node:fs');
    const path = require('node:path');
    const root = resolve(here, '../..');

    const definitionCorpus = [
      styles, dark, light, highContrast, nondescript,
      read('../themes/chat-shell-tokens.css'),
      read('../themes/chat-shell.css'),
    ].join('\n');
    const defined = new Set();
    for (const m of definitionCorpus.matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1]);

    const files = [path.join(root, 'src/styles.css')];
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (!full.includes('__tests__')) walk(full);
        } else if (/\.(js|jsx|css)$/.test(entry)) {
          files.push(full);
        }
      }
    };
    walk(path.join(root, 'src/ui'));
    walk(path.join(root, 'src/themes'));

    const undefinedRefs = new Map();
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/var\(\s*(--(?:color|font|space|border-radius)[\w-]*)/g)) {
        if (!defined.has(m[1])) {
          const rel = path.relative(root, file);
          undefinedRefs.set(m[1], (undefinedRefs.get(m[1]) ?? new Set()).add(rel));
        }
      }
    }

    const report = [...undefinedRefs.entries()]
      .map(([token, where]) => `${token} (${[...where].join(', ')})`);
    expect(report).toEqual([]);
  });
});

describe('focus-ring conformance', () => {
  const chatShell = read('../themes/chat-shell.css');

  it('every :focus-visible outline uses the focus token', () => {
    for (const [name, css] of [['styles.css', styles], ['chat-shell.css', chatShell]]) {
      for (const m of css.matchAll(/:focus-visible[^{}]*\{([^}]*)\}/g)) {
        const outline = m[1].match(/outline:\s*[^;]*var\((--[\w-]+)\)/);
        if (outline) {
          expect(outline[1], `${name}: ${m[0].slice(0, 70)}`).toBe('--color-focus');
        }
      }
    }
  });

  it('every outline suppression in styles.css pairs with a focus-visible ring', () => {
    const ringBases = new Set(
      [...styles.matchAll(/([^,{}]+):focus-visible[^{}]*\{[^}]*outline:\s*2px[^}]*\}/g)]
        .map((m) => m[1].trim().split(/[\s:]/)[0]),
    );
    const offenders = [];
    const noComments = styles.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of noComments.matchAll(/([^{}]+)\{[^}]*outline:\s*(?:none|0)\s*;[^}]*\}/g)) {
      for (const sel of m[1].split(',')) {
        const base = sel.trim().split(/[\s:]/)[0];
        if (base && !ringBases.has(base)) offenders.push(sel.trim());
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the global ring covers links and generic tabindex stops (at zero specificity)', () => {
    expect(styles).toMatch(/:where\(a\[href\]\):focus-visible/);
    expect(styles).toMatch(/:where\(\[tabindex="0"\]\):focus-visible/);
  });
});

describe('shadow system', () => {
  it('box-shadows never hardcode black; they ride --elev-* or --color-shadow', () => {
    const offenders = [];
    styles.split('\n').forEach((line, idx) => {
      if (/box-shadow:/.test(line) && /rgba?\(\s*0\s*,\s*0\s*,\s*0/.test(line)) {
        offenders.push(`${idx + 1}: ${line.trim()}`);
      }
    });
    expect(offenders).toEqual([]);
  });
});

describe('selected-state vocabulary', () => {
  it('.ctab.on marks selection with the accent trio, not white ink', () => {
    const m = styles.match(/\.ctab\.on\s*\{([^}]*)\}/);
    expect(m).not.toBeNull();
    expect(m[1]).toContain('var(--color-text-info)');
    expect(m[1]).toContain('var(--color-border-info)');
  });

  it('.ie.cur treats the current turn as live (blue), not a status (amber)', () => {
    const m = styles.match(/^\.ie\.cur\s*\{([^}]*)\}/m);
    expect(m).not.toBeNull();
    expect(m[1]).toContain('var(--color-background-info)');
    expect(m[1]).not.toContain('warning');
    // A colored border-stripe wider than 1px is the documented anti-pattern.
    expect(m[1]).not.toMatch(/border-left:\s*[2-9]px/);
  });
});
