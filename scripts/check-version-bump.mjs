#!/usr/bin/env node
/**
 * check-version-bump.mjs - refuse a build whose version already matches
 * the one live on the site.
 *
 * `dist/sw.js` bakes package.json's version into its cache name, so a
 * deploy that doesn't bump it ships a byte-identical worker: the
 * browser's update check finds no change, no worker installs, and the
 * "a new build is ready" prompt never appears. The deploy goes green
 * and the shell silently never updates.
 *
 *   node scripts/check-version-bump.mjs            # GitHub Pages URL
 *   node scripts/check-version-bump.mjs <url>      # own-domain deploy
 *
 * A site that isn't serving health.json yet (first deploy, Pages off,
 * network trouble) has nothing to compare against and passes.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { normalizeSiteUrl } from './verify-deploy.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_URL = 'https://ceearrbee.github.io/matrixvtt/';

export function parseLiveVersion(text) {
  try {
    const version = JSON.parse(text)?.version;
    return typeof version === 'string' ? version : null;
  } catch {
    return null;
  }
}

export function decideVersionBump({ liveVersion, builtVersion }) {
  if (!liveVersion) {
    return { ok: true, reason: 'no live health.json to compare against' };
  }
  if (liveVersion === builtVersion) {
    return {
      ok: false,
      reason: `version ${builtVersion} is already live; bump package.json or the service worker will not update`,
    };
  }
  return { ok: true, reason: `live ${liveVersion} -> building ${builtVersion}` };
}

async function fetchLiveVersion(site) {
  try {
    const res = await fetch(`${site}health.json`, { redirect: 'follow' });
    if (!res.ok) return null;
    return parseLiveVersion(await res.text());
  } catch {
    return null;
  }
}

async function main() {
  const site = normalizeSiteUrl(process.argv[2] || process.env.SITE_URL || DEFAULT_URL);
  const { version: builtVersion } = JSON.parse(readFileSync(resolve(HERE, '../package.json'), 'utf8'));
  const liveVersion = await fetchLiveVersion(site);
  const verdict = decideVersionBump({ liveVersion, builtVersion });
  if (!verdict.ok) {
    console.error(`FAIL  ${site} ${verdict.reason}`);
    process.exit(1);
  }
  console.log(`  ok  ${site} ${verdict.reason}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((err) => { console.error(`check-version-bump aborted: ${err.message}`); process.exit(1); });
}
