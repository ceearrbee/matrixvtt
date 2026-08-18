/**
 * Static build smoke test - verifies the production bundle that goes to
 * GitHub Pages actually loads from the configured base path. Catches
 * regressions where a wrong `base:` in vite.config.js or a stray
 * absolute `/foo` asset path would 404 in production.
 *
 * Assumes `npm run build` has already run; CI should pipeline these in
 * order. Running this test alone without a built `dist/` will fail at
 * the existence check, which is the right behaviour.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '../..');
const DIST = resolve(ROOT, 'dist');
// Mirror the build's base (VITE_BASE) so this passes for any deploy target -
// the GitHub-Pages `/matrixvtt/` default OR an own-domain root/subpath.
const RAW_BASE = process.env.VITE_BASE || '/matrixvtt/';
const BASE = RAW_BASE.endsWith('/') ? RAW_BASE : `${RAW_BASE}/`;
const ASSET_PREFIX = `${BASE}assets/`;
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('static build - GitHub Pages base path', () => {
  beforeAll(() => {
    if (!existsSync(DIST)) {
      throw new Error('dist/ missing - run `npm run build` first.');
    }
  });

  it('widget entry (index.html) ships and references base-prefixed assets', () => {
    const html = readFileSync(resolve(DIST, 'index.html'), 'utf8');
    expect(html).toMatch(new RegExp(`<script[^>]+type="module"[^>]+src="${reEsc(ASSET_PREFIX)}widget-[^"]+\\.js"`));
    // Guard against a stray root-absolute asset when deployed under a subpath.
    if (BASE !== '/') expect(html).not.toMatch(/src="\/assets\//);
  });

  it('standalone entry (app.html) ships and references base-prefixed assets', () => {
    const html = readFileSync(resolve(DIST, 'app.html'), 'utf8');
    expect(html).toMatch(new RegExp(`<script[^>]+type="module"[^>]+src="${reEsc(ASSET_PREFIX)}app-[^"]+\\.js"`));
    if (BASE !== '/') expect(html).not.toMatch(/src="\/assets\//);
  });

  it('app.html PWA references (manifest, icon, service worker) follow the base', () => {
    const html = readFileSync(resolve(DIST, 'app.html'), 'utf8');
    expect(html).toContain(`<link rel="manifest" href="${BASE}manifest.json">`);
    expect(html).toContain(`<link rel="apple-touch-icon" href="${BASE}icon.svg">`);
    expect(html).toContain(`serviceWorker.register('${BASE}sw.js', { scope: '${BASE}' })`);
  });

  it('ships a Content-Security-Policy meta tag with enforcing directives', () => {
    for (const entry of ['index.html', 'app.html']) {
      const html = readFileSync(resolve(DIST, entry), 'utf8');
      const match = html.match(
        /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i
      );
      expect(match, `${entry} missing CSP meta tag`).not.toBeNull();
      const policy = match[1];
      // These directives genuinely enforce - closing <base> hijack,
      // form exfil, and <object>/<embed> injection.
      expect(policy, `${entry} CSP missing base-uri`).toMatch(/base-uri\s+'self'/);
      expect(policy, `${entry} CSP missing form-action`).toMatch(/form-action\s+'self'/);
      expect(policy, `${entry} CSP missing object-src 'none'`).toMatch(/object-src\s+'none'/);
      expect(policy, `${entry} CSP missing default-src 'self'`).toMatch(/default-src\s+'self'/);
    }
  });

  it('ships a build-version meta tag for end-user bug triage', () => {
    for (const entry of ['index.html', 'app.html']) {
      const html = readFileSync(resolve(DIST, entry), 'utf8');
      expect(html, `${entry} missing build-version meta`).toMatch(
        /<meta\s+name="build-version"\s+content="[^"]+">/i,
      );
    }
  });

  it('ships a health.json with version + built_at for uptime monitors', () => {
    const path = resolve(DIST, 'health.json');
    expect(existsSync(path), 'dist/health.json missing').toBe(true);
    const health = JSON.parse(readFileSync(path, 'utf8'));
    expect(health.status).toBe('ok');
    expect(typeof health.version).toBe('string');
    expect(health.version.length).toBeGreaterThan(0);
    expect(typeof health.built_at).toBe('string');
  });

  it('ships robots.txt + sitemap.xml for crawlers', () => {
    expect(existsSync(resolve(DIST, 'robots.txt'))).toBe(true);
    expect(existsSync(resolve(DIST, 'sitemap.xml'))).toBe(true);
  });

  it('ships the OGL 1.0a license text alongside the OGL-derived rulesets', () => {
    const ogl = readFileSync(resolve(DIST, 'licenses/OGL-1.0a.txt'), 'utf8');
    expect(ogl).toContain('OPEN GAME LICENSE Version 1.0a');
    expect(ogl).toContain('Old-School Essentials System Reference Document');
    expect(ogl).toContain('D6 Adventure (WEG 51011)');
  });

  it('substitutes __BUILD_VERSION__ in sw.js so every deploy invalidates the shell cache', () => {
    const sw = readFileSync(resolve(DIST, 'sw.js'), 'utf8');
    expect(sw, 'sw.js still contains the __BUILD_VERSION__ placeholder').not.toMatch(/__BUILD_VERSION__/);
    expect(sw).toMatch(/SHELL\s*=\s*['"]mvtt-shell-[0-9.]+/);
  });

  it('ships a 404.html branded fallback for unknown paths', () => {
    const path = resolve(DIST, '404.html');
    expect(existsSync(path)).toBe(true);
    const html = readFileSync(path, 'utf8');
    expect(html).toMatch(/<title>[^<]*404/i);
    // Defensive: 404 page is pure HTML/CSS and shouldn't run any JS.
    expect(html).toMatch(/script-src 'none'/);
  });

  // No test pins the post-login runtime (chat-integrator, konva,
  // sonner, marked) as dynamically imported: static imports are the
  // intentional design, because the dynamic-import variant left Resume
  // hanging for tens of seconds on flaky mobile networks. The asset
  // size trade-off buys reliable mobile resume; see the comment block
  // at the top of src/app-client.js.

  // The deploy metadata files (sw.js, manifest.json, robots.txt,
  // sitemap.xml, 404.html) must follow VITE_BASE and SITE_ORIGIN like
  // the HTML entries do; hardcoded /matrixvtt/ paths silently break
  // own-domain deploys, and crawler files need absolute URLs.
  const SITE_ORIGIN = (process.env.SITE_ORIGIN || 'https://ceearrbee.github.io').replace(/\/$/, '');
  const DEPLOY_META_FILES = ['sw.js', 'manifest.json', 'robots.txt', 'sitemap.xml', '404.html'];

  it('deploy metadata carries no unsubstituted placeholders', () => {
    for (const file of DEPLOY_META_FILES) {
      const text = readFileSync(resolve(DIST, file), 'utf8');
      expect(text, `${file} still contains a build placeholder`)
        .not.toMatch(/__(?:BUILD_VERSION|BASE_URL|SITE_ORIGIN)__/);
    }
  });

  it('manifest.json start_url, scope, and icon follow the base', () => {
    const manifest = JSON.parse(readFileSync(resolve(DIST, 'manifest.json'), 'utf8'));
    expect(manifest.start_url).toBe(`${BASE}app.html`);
    expect(manifest.scope).toBe(BASE);
    expect(manifest.icons[0].src).toBe(`${BASE}icon.svg`);
  });

  it('sw.js precaches base-prefixed shell paths', () => {
    const sw = readFileSync(resolve(DIST, 'sw.js'), 'utf8');
    expect(sw).toContain(`'${BASE}app.html'`);
    expect(sw).toContain(`'${BASE}manifest.json'`);
  });

  it('sitemap locs and the robots Sitemap line are absolute deploy URLs', () => {
    const sitemap = readFileSync(resolve(DIST, 'sitemap.xml'), 'utf8');
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThan(0);
    for (const loc of locs) {
      expect(loc, `sitemap loc must be absolute: ${loc}`).toMatch(new RegExp(`^${reEsc(SITE_ORIGIN + BASE)}`));
    }
    const robots = readFileSync(resolve(DIST, 'robots.txt'), 'utf8');
    expect(robots).toContain(`Sitemap: ${SITE_ORIGIN}${BASE}sitemap.xml`);
  });

  it('404.html routes back into the app under the base', () => {
    const html = readFileSync(resolve(DIST, '404.html'), 'utf8');
    expect(html).toContain(`href="${BASE}app.html"`);
    if (BASE !== '/matrixvtt/') expect(html).not.toContain('/matrixvtt/');
  });

  it('ships the self-hosted fonts and references them under the base', () => {
    for (const file of [
      'fonts/work-sans.css', 'fonts/serif-display.css',
      'fonts/work-sans-latin.woff2', 'fonts/source-serif-4-latin.woff2', 'fonts/bodoni-moda-latin.woff2',
    ]) {
      expect(existsSync(resolve(DIST, file)), `dist/${file} missing`).toBe(true);
    }
    for (const entry of ['index.html', 'app.html']) {
      const html = readFileSync(resolve(DIST, entry), 'utf8');
      expect(html).toContain(`href="${BASE}fonts/work-sans.css"`);
      expect(html).not.toContain('fonts.googleapis.com');
      expect(html).not.toContain('fonts.gstatic.com');
    }
  });

  it('driver.js (onboarding tour) loads lazily, not in either eager set', () => {
    for (const entry of ['index.html', 'app.html']) {
      const html = readFileSync(resolve(DIST, entry), 'utf8');
      expect(html, `${entry} references a driver chunk eagerly`).not.toMatch(/assets\/driver-/);
    }
  });

  it('every modulepreload + script in entries points to a file that exists in dist/', () => {
    for (const entry of ['index.html', 'app.html']) {
      const html = readFileSync(resolve(DIST, entry), 'utf8');
      const refRe = new RegExp(`(?:src|href)="(${reEsc(BASE)}[^"]+\\.(?:js|css))"`, 'g');
      const refs = [...html.matchAll(refRe)].map((m) => m[1]);
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) {
        const relative = ref.replace(BASE, '');
        expect(existsSync(resolve(DIST, relative)), `${entry} references missing asset ${ref}`).toBe(true);
      }
    }
  });
});
