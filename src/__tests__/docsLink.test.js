/**
 * ${BASE_URL}docs/ links 404 in dev: the VitePress site is only built
 * by the deploy workflow (and package.sh), never by `npm run dev`, so
 * the SPA fallback served a widget shell stuck on a loading spinner.
 * In dev the links point at the deployed docs site instead.
 */
import { describe, it, expect } from 'vitest';
import { docsHref, DEPLOYED_DOCS_URL } from '../utils/docs-link.js';

describe('docsHref', () => {
  it('serves the local docs path in production builds', () => {
    expect(docsHref('', { dev: false, base: '/matrixvtt/' })).toBe('/matrixvtt/docs/');
    expect(docsHref('formats/campaign', { dev: false, base: '/matrixvtt/' }))
      .toBe('/matrixvtt/docs/formats/campaign');
  });

  it('points at the deployed site during dev, where docs are not built', () => {
    expect(docsHref('', { dev: true, base: '/' })).toBe(`${DEPLOYED_DOCS_URL}`);
    expect(docsHref('formats/campaign', { dev: true, base: '/' }))
      .toBe(`${DEPLOYED_DOCS_URL}formats/campaign`);
  });

  it('the three docs surfaces route through the helper', async () => {
    const fs = await import('node:fs');
    for (const file of ['src/standalone/StandaloneShell.jsx', 'src/ui/global-menu-items.js', 'src/ui/SetupWizard.jsx']) {
      const src = fs.readFileSync(`${process.cwd()}/${file}`, 'utf8');
      expect(src, `${file} should use docsHref`).toContain('docsHref');
    }
  });
});
