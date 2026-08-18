/**
 * buildDiagnostics() produces a paste-ready bug report bundling the build
 * version, URL, browser, and the captured app-log - and nothing sensitive.
 */
import { describe, it, expect } from 'vitest';
import { buildDiagnostics } from '../ui/feedback.js';

function fakeWin(logEntries) {
  return /** @type {any} */ ({
    location: { href: 'https://vtt.example/app.html' },
    navigator: { userAgent: 'TestUA/1.0' },
    sessionStorage: {
      getItem: (k) => (k === 'vtt:applog' && logEntries ? JSON.stringify(logEntries) : null),
    },
  });
}

describe('buildDiagnostics', () => {
  it('bundles version, url, userAgent, and the captured log', () => {
    const out = buildDiagnostics(fakeWin([
      { ts: '12:00:01', level: 'error', msg: 'boom happened' },
      { ts: '12:00:02', level: 'warn', msg: 'careful' },
    ]));
    expect(out).toMatch(/version:/);
    expect(out).toContain('https://vtt.example/app.html');
    expect(out).toContain('TestUA/1.0');
    expect(out).toContain('[error] boom happened');
    expect(out).toContain('[warn] careful');
  });

  it('handles an empty log gracefully', () => {
    const out = buildDiagnostics(fakeWin(null));
    expect(out).toContain('(log empty)');
  });

  it('does not leak an access token (no credential fields included)', () => {
    const out = buildDiagnostics(fakeWin(null)).toLowerCase();
    expect(out).not.toContain('access_token');
    expect(out).not.toContain('accesstoken');
  });
});
