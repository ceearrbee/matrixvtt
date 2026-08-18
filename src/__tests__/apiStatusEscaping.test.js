/**
 * Lock-in tests for ApiStatus component.
 * Verifies that dynamic fields are rendered safely (Preact native escaping).
 */
import { describe, it, expect } from 'vitest';
import { h } from 'preact';
import { render, screen } from '@testing-library/preact';
import { ApiStatus } from '../ui/sync/ApiStatus.jsx';

function mkUi({ hs = 'matrix.org', roomVersion = '11' } = {}) {
  return {
    widgetManager: {
      homeserver: hs,
      rateLimitedUntil: 0,
      lastRetryAfterMs: null,
      serverCapabilities: { 'm.room_versions': { default: roomVersion } },
    },
    _queueCount: 0,
  };
}

describe('ApiStatus component safety', () => {
  it('renders XSS-shaped homeserver safely (escaped)', () => {
    const ui = mkUi({ hs: '<script>alert(1)</script>' });
    render(h(ApiStatus, { ui }));
    
    // getByText finds the text content, which should be the raw string if escaped correctly in DOM
    expect(screen.getByText('<script>alert(1)</script>')).toBeTruthy();
    // Verify it's not a script tag
    expect(document.querySelector('script')).toBeNull();
  });

  it('renders XSS-shaped server room version safely (escaped)', () => {
    const ui = mkUi({ roomVersion: '"><img src=x>' });
    render(h(ApiStatus, { ui }));
    
    expect(screen.getByText('"><img src=x>')).toBeTruthy();
    expect(document.querySelector('img')).toBeNull();
  });
});
