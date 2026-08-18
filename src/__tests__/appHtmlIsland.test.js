/**
 * The app.html pre-auth style island: Bodoni Moda is display-only per
 * DESIGN.md, yet the island aliased it as the body-prose face across
 * twelve sites. Prose reads Source Serif 4 (--font-body from
 * styles.css, which app.html links); chrome inherits Work Sans. The
 * standalone entry also needs a pre-hydration loading shell (the
 * widget entry has one) and loading copy without protocol jargon.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const appHtml = fs.readFileSync(path.join(process.cwd(), 'app.html'), 'utf8');
const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');

describe('app.html style island', () => {
  it('never uses Bodoni Moda as a body/prose face', () => {
    expect(appHtml).not.toContain('--font-body-serif');
    const island = appHtml.slice(appHtml.indexOf('<style>'), appHtml.indexOf('</style>'));
    expect(island).not.toContain('Bodoni');
  });

  it('gives the standalone entry a pre-hydration loading shell', () => {
    const root = appHtml.match(/<div id="vtt-shell-root">([\s\S]*?)<\/div>/);
    expect(root).not.toBeNull();
    expect(root[1]).toContain('vtt-loading');
  });

  it('loading copy speaks player language, not protocol jargon', () => {
    expect(indexHtml).not.toContain('Connecting to Matrix');
    expect(indexHtml).toMatch(/Loading your table/);
    expect(appHtml).toMatch(/Loading your table/);
  });
});
