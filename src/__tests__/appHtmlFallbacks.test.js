/**
 * app.html pre-JS affordances: a JS-disabled or legacy browser got a
 * completely blank page (the only noscript was a font stylesheet), and
 * the beta notice paragraph had no styles while every sibling class in
 * the auth card does.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync(path.join(process.cwd(), 'app.html'), 'utf8');

describe('app.html fallbacks', () => {
  it('shows a real message when JavaScript is unavailable', () => {
    const bodyHalf = html.slice(html.indexOf('<body'));
    const noscript = bodyHalf.match(/<noscript>([\s\S]*?)<\/noscript>/);
    expect(noscript).not.toBeNull();
    expect(noscript[1]).toMatch(/requires JavaScript/i);
    expect(noscript[1]).toMatch(/browser/i);
  });

  it('styles the auth beta notice and hint classes in the pre-auth island', () => {
    expect(html).toMatch(/\.auth-beta-notice\s*\{/);
    expect(html).toMatch(/\.auth-hint\s*\{/);
    expect(html).toMatch(/\.auth-hint__retry\s*\{/);
  });
});
