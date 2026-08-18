/**
 * Explicit http:// on a local development host must survive through
 * the MatrixClient statics too, or the login POST goes to an https
 * port that isn't listening (docs/SETUP.md runs Synapse on :8008).
 */
import { describe, it, expect } from 'vitest';
import { isLocalHost } from '../utils/local-host.js';
import { MatrixClient } from '../client/MatrixClient.js';

describe('isLocalHost', () => {
  it.each([
    ['localhost', true],
    ['localhost:8008', true],
    ['127.0.0.1:8008', true],
    ['192.168.1.20', true],
    ['10.0.0.5:8008', true],
    ['synapse.local', true],
    ['matrix.org', false],
    ['example.synapse.test', false],
    ['', false],
  ])('%s → %s', (host, expected) => {
    expect(isLocalHost(host)).toBe(expected);
  });
});

describe('MatrixClient._getHsBase scheme handling', () => {
  it.each([
    ['http://localhost:8008', 'http://localhost:8008'],
    ['HTTP://127.0.0.1:8008', 'http://127.0.0.1:8008'],
    ['http://matrix.org',     'https://matrix.org'],
    ['matrix.org',            'https://matrix.org'],
    ['https://matrix.org',    'https://matrix.org'],
    ['localhost:8008',        'https://localhost:8008'],
  ])('%s → %s', (input, expected) => {
    expect(MatrixClient._getHsBase(input)).toBe(expected);
  });
});
