/**
 * The homeserver block of MatrixClient - discovery, login flows, SSO,
 * registration, the three login shapes and the two URL normalisers -
 * takes a homeserver string and touches no instance state. It is its
 * own module now; MatrixClient keeps the statics because
 * `app.MatrixClient.X` is the seam the e2e fake client overrides.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as homeserver from '../homeserver.js';
import { MatrixClient } from '../MatrixClient.js';

const read = (rel) => readFileSync(resolve(import.meta.dirname, '../../../', rel), 'utf8');

describe('normalizeHomeserver', () => {
  it.each([
    ['https://matrix.org/', 'matrix.org'],
    ['http://localhost:8008', 'localhost:8008'],
    ['https://https://matrix.org', 'matrix.org'],
    ['  matrix.org  ', 'matrix.org'],
    ['', ''],
    [null, ''],
  ])('%s -> %s', (input, expected) => {
    expect(homeserver.normalizeHomeserver(input)).toBe(expected);
  });
});

describe('homeserverBaseUrl', () => {
  it.each([
    ['http://localhost:8008', 'http://localhost:8008'],
    ['HTTP://127.0.0.1:8008', 'http://127.0.0.1:8008'],
    ['http://matrix.org', 'https://matrix.org'],
    ['matrix.org', 'https://matrix.org'],
    ['', ''],
  ])('%s -> %s', (input, expected) => {
    expect(homeserver.homeserverBaseUrl(input)).toBe(expected);
  });
});

describe('the module owns the whole homeserver surface', () => {
  it('exports every call the auth screens make', () => {
    for (const name of [
      'normalizeHomeserver', 'homeserverBaseUrl', 'discoverHomeserver',
      'getLoginFlows', 'getSSORedirectURL', 'register',
      'requestRegisterEmailToken', 'login', 'loginWithToken', 'loginWithSSOToken',
    ]) {
      expect(typeof homeserver[name], name).toBe('function');
    }
  });

  it('MatrixClient keeps the statics the e2e fake overrides', () => {
    for (const name of [
      'discoverHomeserver', 'getLoginFlows', 'getSSORedirectURL', 'register',
      'requestRegisterEmailToken', 'login', 'loginWithToken', 'loginWithSSOToken',
      '_normalizeHs', '_getHsBase',
    ]) {
      expect(typeof MatrixClient[name], name).toBe('function');
    }
  });
});

describe('MatrixClient.js', () => {
  it('says what it is and no longer carries the homeserver block', () => {
    const src = read('src/client/MatrixClient.js');
    expect(src.startsWith('/**')).toBe(true);
    expect(src).not.toMatch(/AutoDiscovery/);
    expect(src.split('\n').length).toBeLessThan(500);
  });
});
