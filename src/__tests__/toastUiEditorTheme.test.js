/**
 * The @toast-ui editor owns the handout/page prose surface - the one
 * the Player's Almanac north star cares most about - yet only two
 * override rules existed, leaving vendor light-theme chrome and prose
 * in a dark-default app. Dark and Light are hand-checked; High
 * Contrast and Nondescript inherit the token-driven treatment.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const css = fs.readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8');

function editorRules() {
  const rules = [];
  const re = /(^|\n)([^{}]*\.markdown-editor-host[^{}]*)\{([^}]*)\}/g;
  for (const m of css.matchAll(re)) rules.push({ selector: m[2].trim(), body: m[3] });
  return rules;
}

describe('toast-ui editor theming', () => {
  it('re-skins chrome and prose surface onto the token contract', () => {
    const rules = editorRules();
    expect(rules.length).toBeGreaterThanOrEqual(8);
    const all = rules.map((r) => r.body).join('\n');

    expect(all).toContain('var(--color-background-primary)');
    expect(all).toContain('var(--color-background-secondary)');
    expect(all).toContain('var(--color-text-primary)');
    expect(all).toContain('var(--color-text-info)');

    const contents = rules.find((r) => r.selector.includes('.toastui-editor-contents'));
    expect(contents).toBeTruthy();
    expect(rules.filter((r) => r.selector.includes('.toastui-editor-contents')).map((r) => r.body).join('\n'))
      .toContain('var(--font-body)');
  });

  it('drives the vendor icon sprite through a per-theme filter token', () => {
    const all = editorRules().map((r) => r.body).join('\n');
    expect(all).toContain('var(--vendor-icon-filter');
    for (const theme of ['dark', 'light', 'high-contrast', 'nondescript']) {
      const themeCss = fs.readFileSync(path.join(ROOT, `src/themes/${theme}.css`), 'utf8');
      expect(themeCss, `${theme}.css must define --vendor-icon-filter`).toContain('--vendor-icon-filter');
    }
  });
});
