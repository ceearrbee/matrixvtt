/**
 * Pure helpers of scripts/verify-deploy.mjs. The network walk itself
 * runs against the live site (npm run verify:deploy); these pin the
 * parsing so a quiet regex regression can't turn the script into a
 * yes-machine.
 */
import { describe, it, expect } from 'vitest';
import { normalizeSiteUrl, extractAssetRefs, findPlaceholders } from '../../scripts/verify-deploy.mjs';

describe('normalizeSiteUrl', () => {
  it('adds scheme and trailing slash as needed', () => {
    expect(normalizeSiteUrl('ceearrbee.github.io/matrixvtt')).toBe('https://ceearrbee.github.io/matrixvtt/');
    expect(normalizeSiteUrl('https://vtt.example.com/')).toBe('https://vtt.example.com/');
    expect(normalizeSiteUrl('http://localhost:4173/matrixvtt')).toBe('http://localhost:4173/matrixvtt/');
  });
});

describe('extractAssetRefs', () => {
  it('collects js and css refs from link and script tags, deduped', () => {
    const html = `
      <link rel="modulepreload" crossorigin href="/matrixvtt/assets/app-abc.js">
      <link rel="stylesheet" href="/matrixvtt/fonts/work-sans.css">
      <script type="module" crossorigin src="/matrixvtt/assets/app-abc.js"></script>
      <link rel="manifest" href="/matrixvtt/manifest.json">
      <img src="/matrixvtt/icon.svg">
    `;
    expect(extractAssetRefs(html).sort()).toEqual([
      '/matrixvtt/assets/app-abc.js',
      '/matrixvtt/fonts/work-sans.css',
    ]);
  });
});

describe('findPlaceholders', () => {
  it('reports each leftover deploy placeholder once', () => {
    expect(findPlaceholders('x __BASE_URL__ y __BASE_URL__ z __SITE_ORIGIN__')).toEqual([
      '__BASE_URL__', '__SITE_ORIGIN__',
    ]);
    expect(findPlaceholders('clean text')).toEqual([]);
  });
});
