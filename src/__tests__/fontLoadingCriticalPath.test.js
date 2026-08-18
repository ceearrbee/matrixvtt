/**
 * The three families are self-hosted from public/fonts/ (latin
 * variable woff2). Google-hosted fonts stopped being a shared-cache
 * win when browsers partitioned the HTTP cache per site, and the
 * css2 stylesheet added a two-hop dependency (css2 resolves before
 * the browser learns any gstatic URL) plus two third-party origins
 * in the CSP. Self-hosting keeps one origin, lets the service
 * worker cache fonts for offline resume, and drops both hosts from
 * the CSP.
 *
 * The split loading strategy survives: Work Sans is the only chrome
 * family, so fonts/work-sans.css is the only render-blocking font
 * stylesheet. Source Serif 4 (prose) and Bodoni Moda (display) ride
 * fonts/serif-display.css, deferred via the media="print" onload
 * swap with a noscript fallback.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '../..');
const ENTRIES = ['index.html', 'app.html'];
const FONTS_DIR = resolve(ROOT, 'public/fonts');

const WOFF2_FILES = [
  'work-sans-latin.woff2',
  'work-sans-latin-italic.woff2',
  'source-serif-4-latin.woff2',
  'source-serif-4-latin-italic.woff2',
  'bodoni-moda-latin.woff2',
  'bodoni-moda-latin-italic.woff2',
];

describe.each(ENTRIES)('%s font loading', (entry) => {
  const html = readFileSync(resolve(ROOT, entry), 'utf8');

  it('never references a Google Fonts host, CSP included', () => {
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
  });

  it('blocks first paint on the chrome family only', () => {
    const active = html.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
    const links = [...active.matchAll(/<link[^>]*href="%BASE_URL%fonts\/[^"]+"[^>]*>/g)].map((m) => m[0]);
    const blocking = links.filter((l) => !/media=["']print["']/.test(l));
    const blockingSheets = blocking.filter((l) => l.includes('work-sans.css'));
    expect(blockingSheets).toHaveLength(1);
    expect(blocking.some((l) => l.includes('serif-display.css'))).toBe(false);
  });

  it('defers the prose and display families behind the print-media swap', () => {
    expect(html).toMatch(
      /<link[^>]*href="%BASE_URL%fonts\/serif-display\.css"[^>]*media="print"[^>]*onload="this\.media='all'"/,
    );
  });

  it('still loads the serif stylesheet without scripting', () => {
    expect(html).toMatch(
      /<noscript>\s*<link[^>]*href="%BASE_URL%fonts\/serif-display\.css"[^>]*>\s*<\/noscript>/,
    );
  });
});

describe('self-hosted font files', () => {
  it('ships all six latin variable woff2 files', () => {
    for (const file of WOFF2_FILES) {
      expect(existsSync(resolve(FONTS_DIR, file)), `public/fonts/${file} missing`).toBe(true);
    }
  });

  it('work-sans.css declares only Work Sans, with relative urls and swap', () => {
    const css = readFileSync(resolve(FONTS_DIR, 'work-sans.css'), 'utf8');
    expect(css).toContain("font-family: 'Work Sans'");
    expect(css).not.toContain('Source Serif');
    expect(css).not.toContain('Bodoni');
    expect(css).not.toContain('https://');
    expect(css).toMatch(/font-display:\s*swap/);
  });

  it('serif-display.css declares the prose and display families the same way', () => {
    const css = readFileSync(resolve(FONTS_DIR, 'serif-display.css'), 'utf8');
    expect(css).toContain("font-family: 'Source Serif 4'");
    expect(css).toContain("font-family: 'Bodoni Moda'");
    expect(css).not.toContain('https://');
    expect(css).toMatch(/font-display:\s*swap/);
  });

  it('every url() in the font css points at a shipped woff2', () => {
    for (const sheet of ['work-sans.css', 'serif-display.css']) {
      const css = readFileSync(resolve(FONTS_DIR, sheet), 'utf8');
      const refs = [...css.matchAll(/url\(([^)]+\.woff2)\)/g)].map((m) => m[1].replace(/['"]/g, ''));
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) {
        expect(WOFF2_FILES, `${sheet} references unshipped ${ref}`).toContain(ref);
      }
    }
  });
});
