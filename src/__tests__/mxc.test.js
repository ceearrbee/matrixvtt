import { describe, it, expect } from 'vitest';
import { resolveMediaUrl } from '../utils/mxc.js';

describe('resolveMediaUrl', () => {
  it('passes through http(s) and non-mxc urls unchanged', () => {
    expect(resolveMediaUrl('https://x/y.png', 'https://hs')).toBe('https://x/y.png');
    expect(resolveMediaUrl('/icons/a.svg', 'https://hs')).toBe('/icons/a.svg');
  });

  it('resolves an mxc uri against the given homeserver', () => {
    expect(resolveMediaUrl('mxc://example.org/abc123', 'https://hs.example'))
      .toBe('https://hs.example/_matrix/media/v3/download/example.org/abc123');
  });

  it('falls back to the media server host when no homeserver is given', () => {
    expect(resolveMediaUrl('mxc://example.org/abc123', null))
      .toBe('https://example.org/_matrix/media/v3/download/example.org/abc123');
  });

  it('returns null for empty input', () => {
    expect(resolveMediaUrl('', 'https://hs')).toBeNull();
    expect(resolveMediaUrl(null, 'https://hs')).toBeNull();
  });
});
