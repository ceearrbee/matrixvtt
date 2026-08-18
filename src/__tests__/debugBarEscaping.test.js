/**
 * Lock-in tests for DebugBar component safety.
 * Verifies that dynamic fields are rendered safely (Preact native escaping).
 */
import { describe, it, expect } from 'vitest';
import { h } from 'preact';
import { render, screen } from '@testing-library/preact';
import { DebugBar } from '../ui/sync/DebugBar.jsx';

function mkUi({ hs = 'matrix.org', uid = '@u:m.org', rid = '!r:m.org', mid = 'map1' } = {}) {
  return {
    widgetManager: {
      homeserver: hs,
      userId: uid,
      roomId: rid,
      accessToken: 'secret',
      callsLastMinute: [],
    },
    state: { activeMapId: mid },
    _copyDebugToken: () => {},
    _clearDebugStorage: () => {},
    _hardReload: () => {},
  };
}

describe('DebugBar component safety', () => {
  it('renders XSS-shaped homeserver safely (escaped)', () => {
    const ui = mkUi({ hs: '<script>alert(1)</script>' });
    render(h(DebugBar, { ui }));
    expect(screen.getByText('<script>alert(1)</script>')).toBeTruthy();
    expect(document.querySelector('script')).toBeNull();
  });

  it('renders XSS-shaped room id safely (escaped)', () => {
    const ui = mkUi({ rid: '"><img src=x>' });
    render(h(DebugBar, { ui }));
    expect(screen.getByText((content, element) => {
      return element.tagName.toLowerCase() === 'span' && content.includes('Room:');
    })).toBeTruthy();
    expect(screen.getByText('"><img src=x>')).toBeTruthy();
    expect(document.querySelector('img')).toBeNull();
  });

  it('renders XSS-shaped active map id safely (escaped)', () => {
    const ui = mkUi({ mid: '<svg/onload=1>' });
    render(h(DebugBar, { ui }));
    expect(screen.getByText((content, element) => {
      return element.tagName.toLowerCase() === 'span' && content.includes('Map:');
    })).toBeTruthy();
    expect(screen.getByText('<svg/onload=1>')).toBeTruthy();
    expect(document.querySelector('svg')).toBeNull();
  });
});
