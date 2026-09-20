/**
 * mediaSrc - the one thing a DOM <img src> should be handed.
 *
 * `mxc://` is not a scheme a browser can fetch, so every <img> that was
 * given one rendered nothing. The canvas path already resolved through
 * resolveMediaUrl; this gives the DOM paths the same treatment without
 * making every caller thread a homeserver through.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mediaSrc } from '../utils/media-src.js';
import { homeserverSignal } from '../state/ui-signals.js';

afterEach(() => { homeserverSignal.value = null; });

describe('mediaSrc', () => {
  it('resolves an mxc uri against the session homeserver', () => {
    homeserverSignal.value = 'https://hs.example';
    expect(mediaSrc('mxc://hs.example/abc123'))
      .toBe('https://hs.example/_matrix/media/v3/download/hs.example/abc123');
  });

  it('falls back to the host inside the uri when no homeserver is known', () => {
    expect(mediaSrc('mxc://media.example/abc123'))
      .toBe('https://media.example/_matrix/media/v3/download/media.example/abc123');
  });

  it('passes an https url straight through', () => {
    homeserverSignal.value = 'https://hs.example';
    expect(mediaSrc('https://cdn.example/map.png')).toBe('https://cdn.example/map.png');
  });

  it('passes a built-in icon or tile path straight through', () => {
    expect(mediaSrc('/matrixvtt/icons/dark/lorc/sword.svg')).toBe('/matrixvtt/icons/dark/lorc/sword.svg');
    expect(mediaSrc('/matrixvtt/backgrounds/tiles/cobble.webp')).toBe('/matrixvtt/backgrounds/tiles/cobble.webp');
  });

  // An <img src=""> re-requests the current page in some browsers, so
  // an absent portrait has to mean "render no image at all", which is
  // what every caller already checks for.
  it('returns null for nothing, rather than an empty string', () => {
    expect(mediaSrc(null)).toBeNull();
    expect(mediaSrc('')).toBeNull();
    expect(mediaSrc(undefined)).toBeNull();
  });
});
