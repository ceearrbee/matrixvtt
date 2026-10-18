/**
 * html and body never scroll, so the login and discovery screens cut off
 * everything below the fold unless the shell scrolls itself. The real
 * check is tests/e2e/standalone-scroll.spec.js; this one runs without a
 * build.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync(path.join(process.cwd(), 'app.html'), 'utf8');
const styles = fs.readFileSync(path.join(process.cwd(), 'src/styles.css'), 'utf8');

// Every top-level block for the selector, joined: app.html declares
// .standalone-shell twice.
function ruleBody(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g');
  return [...css.matchAll(pattern)].map((m) => m[1]).join('\n');
}

describe('standalone shell scrolling', () => {
  it('html and body clip the page, so something else has to scroll', () => {
    expect(ruleBody(styles, 'html,\nbody')).toMatch(/overflow:\s*hidden/);
  });

  it('the shell is one viewport tall and scrolls its content', () => {
    const shell = ruleBody(html, '.standalone-shell');
    expect(shell).toMatch(/height:\s*100dvh/);
    expect(shell).toMatch(/overflow-y:\s*auto/);
  });

  it('the sticky sidebar scrolls when it is taller than the window', () => {
    const sidebar = ruleBody(html, '.standalone-sidebar');
    expect(sidebar).toMatch(/position:\s*sticky/);
    expect(sidebar).toMatch(/overflow-y:\s*auto/);
  });

  // A scroll container in the shell's grid shrinks to nothing, so the
  // stacked phone sidebar must not be one.
  it('the stacked phone sidebar is not a scroll container', () => {
    const phone = html.slice(html.indexOf('@media (max-width: 768px)'));
    const sidebar = ruleBody(phone, '.standalone-sidebar');
    expect(sidebar).toMatch(/height:\s*auto/);
    expect(sidebar).toMatch(/overflow-y:\s*visible/);
  });
});
