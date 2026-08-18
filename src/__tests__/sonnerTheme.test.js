/**
 * Toasts must track the four-theme token system. sonner defaulted to
 * its light theme (white cards in a dark app) and richColors supplied
 * a second status palette outside the design system; the .vtt-sonner
 * class re-skins every toast onto the --color-* contract instead.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const css = fs.readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8');
const notifications = fs.readFileSync(path.join(ROOT, 'src/ui/notifications.js'), 'utf8');

function sonnerRules() {
  const rules = [];
  const re = /(^|\n)([^{}]*\.vtt-sonner[^{}]*)\{([^}]*)\}/g;
  for (const m of css.matchAll(re)) rules.push({ selector: m[2].trim(), body: m[3] });
  return rules;
}

describe('sonner toast theming', () => {
  it('drops richColors (the second status palette)', () => {
    expect(notifications).not.toContain('richColors');
  });

  it('re-skins toasts onto the token contract', () => {
    const rules = sonnerRules();
    expect(rules.length).toBeGreaterThan(0);
    const all = rules.map((r) => r.body).join('\n');

    expect(all).toContain('var(--color-background-secondary)');
    expect(all).toContain('var(--color-text-primary)');
    for (const status of ['danger', 'warning', 'success', 'info']) {
      expect(all).toContain(`var(--color-border-${status})`);
    }
  });

  it('uses no raw hex or rgb literals inside the sonner rules', () => {
    const all = sonnerRules().map((r) => r.body).join('\n');
    expect(all).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(all).not.toMatch(/rgba?\(/);
  });
});
