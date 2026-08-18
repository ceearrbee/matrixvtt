#!/usr/bin/env node
/**
 * verify-deploy.mjs - assert the live deployment is healthy and serving
 * the version this checkout expects. Run after CI deploys:
 *
 *   npm run verify:deploy                    # checks the GitHub Pages URL
 *   node scripts/verify-deploy.mjs <url>     # checks an own-domain deploy
 *
 * Checks: health.json status/version, app.html + build-version meta,
 * every modulepreload/script/stylesheet asset resolves, PWA and crawler
 * metadata is valid with absolute URLs and no leftover placeholders.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_URL = 'https://ceearrbee.github.io/matrixvtt/';

export function normalizeSiteUrl(raw) {
  let url = raw.trim();
  if (!/^https?:\/\//.test(url)) url = `https://${url}`;
  return url.endsWith('/') ? url : `${url}/`;
}

/** Asset URLs (js/css) an entry HTML makes the browser fetch. */
export function extractAssetRefs(html) {
  const refs = new Set();
  for (const m of html.matchAll(/<(?:link|script)[^>]*(?:href|src)="([^"]+\.(?:js|css))"[^>]*>/g)) {
    refs.add(m[1]);
  }
  return [...refs];
}

export function findPlaceholders(text) {
  return [...new Set([...text.matchAll(/__(?:BUILD_VERSION|BASE_URL|SITE_ORIGIN)__/g)].map((m) => m[0]))];
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

async function main() {
  const site = normalizeSiteUrl(process.argv[2] || process.env.SITE_URL || DEFAULT_URL);
  const pkg = JSON.parse(readFileSync(resolve(HERE, '../package.json'), 'utf8'));
  const failures = [];
  let checks = 0;
  const ok = (label) => { checks += 1; console.log(`  ok  ${label}`); };
  const fail = (label) => { checks += 1; failures.push(label); console.error(`FAIL  ${label}`); };

  console.log(`Verifying ${site} against v${pkg.version}\n`);

  const health = JSON.parse(await fetchText(`${site}health.json`));
  health.status === 'ok' ? ok('health.json status ok') : fail(`health.json status: ${health.status}`);
  health.version === pkg.version
    ? ok(`health.json version ${health.version}`)
    : fail(`health.json version ${health.version}, expected ${pkg.version}`);

  const entries = {};
  for (const entry of ['app.html', 'index.html']) {
    const html = (entries[entry] = await fetchText(`${site}${entry}`));
    ok(`${entry} responds`);
    const meta = html.match(/<meta name="build-version" content="([^"]+)">/);
    meta && meta[1] === pkg.version
      ? ok(`${entry} build-version ${meta[1]}`)
      : fail(`${entry} build-version ${meta?.[1] ?? 'missing'}, expected ${pkg.version}`);
  }

  const origin = new URL(site).origin;
  for (const [entry, html] of Object.entries(entries)) {
    for (const ref of extractAssetRefs(html)) {
      const url = new URL(ref, ref.startsWith('/') ? origin : site).href;
      const res = await fetch(url, { method: 'HEAD' });
      res.ok ? ok(`${entry} asset ${ref}`) : fail(`${entry} asset ${ref} -> HTTP ${res.status}`);
    }
  }

  const manifest = JSON.parse(await fetchText(`${site}manifest.json`));
  manifest.start_url && manifest.icons?.length
    ? ok('manifest.json parses with start_url + icons')
    : fail('manifest.json missing start_url or icons');

  const robots = await fetchText(`${site}robots.txt`);
  /^Sitemap: https?:\/\//m.test(robots)
    ? ok('robots.txt Sitemap is absolute')
    : fail('robots.txt Sitemap line missing or not absolute');

  const sitemap = await fetchText(`${site}sitemap.xml`);
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  locs.length > 0 && locs.every((l) => l.startsWith('http'))
    ? ok(`sitemap.xml has ${locs.length} absolute locs`)
    : fail('sitemap.xml locs missing or relative');

  for (const [name, text] of [
    ['robots.txt', robots], ['sitemap.xml', sitemap],
    ['manifest.json', JSON.stringify(manifest)],
    ['sw.js', await fetchText(`${site}sw.js`)],
    ...Object.entries(entries),
  ]) {
    const leftovers = findPlaceholders(text);
    leftovers.length === 0
      ? ok(`${name} has no leftover placeholders`)
      : fail(`${name} still contains ${leftovers.join(', ')}`);
  }

  console.log(`\n${checks - failures.length}/${checks} checks passed`);
  if (failures.length > 0) process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((err) => { console.error(`\nverify-deploy aborted: ${err.message}`); process.exit(1); });
}
