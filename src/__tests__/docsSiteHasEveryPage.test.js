/**
 * Every sidebar link must resolve to a page that exists.
 *
 * Two entries pointed at rewrites of files outside VitePress's srcDir,
 * which produce no page at all. `ignoreDeadLinks: true` meant the build
 * stayed green and the README link in the sidebar simply 404'd.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../');
const config = readFileSync(join(root, 'docs/.vitepress/config.mjs'), 'utf8');

/** Internal doc links from the sidebar and nav, e.g. `/guide/x`. */
function sidebarLinks() {
  return [...config.matchAll(/link:\s*'(\/[^']*)'/g)]
    .map((m) => m[1])
    .filter((link) => link !== '/' && !link.startsWith('/matrixvtt'));
}

describe('the docs site', () => {
  it('has at least the pages we expect to find', () => {
    expect(sidebarLinks().length).toBeGreaterThan(10);
  });

  it.each(sidebarLinks())('has a source file behind %s', (link) => {
    expect(existsSync(join(root, 'docs', `${link.slice(1)}.md`))).toBe(true);
  });

  it('lists the map background guide', () => {
    expect(sidebarLinks()).toContain('/guide/map-backgrounds');
  });

  it('surfaces the bundled-content licences, which is where the art terms live', () => {
    expect(sidebarLinks()).toContain('/licences/third-party');
  });

  // A page that only includes another file is worthless if the include
  // target moves, and the build will not say so.
  it.each([
    ['docs/licences/third-party.md', 'THIRD-PARTY-NOTICES.md'],
    ['docs/contributing/readme.md', 'README.md'],
  ])('%s includes a file that exists', (page, target) => {
    const body = readFileSync(join(root, page), 'utf8');
    const include = body.match(/<!--@include:\s*([^>]+?)\s*-->/);
    expect(include, `${page} has an @include`).toBeTruthy();
    expect(resolve(join(root, page), '..', include[1])).toBe(join(root, target));
    expect(existsSync(join(root, target))).toBe(true);
  });
});
