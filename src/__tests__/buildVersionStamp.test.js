/**
 * BUILD_VERSION is wired from package.json via Vite/Vitest `define`,
 * and rendered into the diagnostics panel.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { h } from 'preact';
import { render, screen } from '@testing-library/preact';

import { BUILD_VERSION } from '../utils/constants.js';
import { ApiStatus } from '../ui/sync/ApiStatus.jsx';

const pkg = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf8')
);

describe('BUILD_VERSION', () => {
  it('matches the version in package.json', () => {
    expect(BUILD_VERSION).toBe(pkg.version);
  });

  it('is a non-empty string', () => {
    expect(typeof BUILD_VERSION).toBe('string');
    expect(BUILD_VERSION.length).toBeGreaterThan(0);
  });
});

describe('ApiStatus diagnostics panel', () => {
  it('renders the MatrixVTT version row when a widgetManager is present', () => {
    const ui = {
      widgetManager: {
        homeserver: 'https://example.org',
        rateLimitedUntil: 0,
        lastRetryAfterMs: null,
        serverCapabilities: null,
      },
      _queueCount: 0,
    };
    render(h(ApiStatus, { ui }));
    expect(screen.getByText('MatrixVTT version')).toBeTruthy();
    expect(screen.getByText(BUILD_VERSION)).toBeTruthy();
  });
});
