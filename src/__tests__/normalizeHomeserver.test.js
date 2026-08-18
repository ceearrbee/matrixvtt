/**
 * The normaliser forces `https://` so the caller never sends credentials
 * over plaintext - with one exception: an EXPLICIT `http://` on a local
 * development host (localhost, 127.0.0.1, RFC1918, .local) is preserved,
 * matching docs/SETUP.md's Synapse-on-:8008 instructions. Returns `null`
 * for empty input.
 */
import { describe, it, expect } from 'vitest';
import { normalizeHomeserver } from '../standalone/auth.js';

describe('normalizeHomeserver', () => {
  it.each([
    ['matrix.org',            'https://matrix.org'],
    ['  matrix.org  ',        'https://matrix.org'],
    ['example.synapse.test',  'https://example.synapse.test'],
    ['https://matrix.org',    'https://matrix.org'],
    ['http://matrix.org',     'https://matrix.org'],
    ['HTTP://localhost:8008', 'http://localhost:8008'],
    ['http://localhost:8008', 'http://localhost:8008'],
    ['http://127.0.0.1:8008', 'http://127.0.0.1:8008'],
    ['http://192.168.1.20:8008', 'http://192.168.1.20:8008'],
    ['http://10.0.0.5:8008',  'http://10.0.0.5:8008'],
    ['http://synapse.local',  'http://synapse.local'],
    ['localhost:8008',        'https://localhost:8008'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeHomeserver(input)).toBe(expected);
  });

  it('returns null for empty input', () => {
    expect(normalizeHomeserver('')).toBeNull();
    expect(normalizeHomeserver('   ')).toBeNull();
    expect(normalizeHomeserver(undefined)).toBeNull();
  });

  it('prepends https to non-http schemes; caller is expected to reject the result', () => {
    expect(normalizeHomeserver('ftp://files.example')).toBe('https://ftp://files.example');
  });
});
