/**
 * The driver.js tour popover is the first interactive surface every
 * new user sees. The vendor stylesheet is light-only (white popover,
 * off-brand radii and shadow); an override layer must re-skin it onto
 * the token contract so all four themes track.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

describe('driver.js tour theming', () => {
  const cssPath = path.join(ROOT, 'src/ui/onboarding-tour.css');

  it('ships an override stylesheet loaded after the vendor CSS, same lazy chunk', () => {
    expect(fs.existsSync(cssPath)).toBe(true);
    const source = fs.readFileSync(path.join(ROOT, 'src/ui/tour-runtime.js'), 'utf8');
    const vendorAt = source.indexOf("import 'driver.js/dist/driver.css'");
    const overrideAt = source.indexOf("import './onboarding-tour.css'");
    expect(vendorAt).toBeGreaterThan(-1);
    expect(overrideAt).toBeGreaterThan(vendorAt);
  });

  it('re-skins the popover onto the token contract, arrows included', () => {
    const css = fs.readFileSync(cssPath, 'utf8');
    expect(css).toMatch(/\.driver-popover\s*\{[^}]*var\(--color-background-secondary\)/);
    expect(css).toContain('var(--color-text-primary)');
    expect(css).toContain('var(--border-radius-lg)');
    for (const side of ['left', 'right', 'top', 'bottom']) {
      expect(css).toContain(`.driver-popover-arrow-side-${side}`);
    }
    expect(css).toMatch(/focus-visible[^}]*var\(--color-focus\)/s);
  });

  it('uses no raw hex or rgb literals', () => {
    const css = fs.readFileSync(cssPath, 'utf8');
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/rgba?\(/);
  });
});
