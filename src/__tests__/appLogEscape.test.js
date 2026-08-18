/**
 * escapeHtml in standalone/app-log.js must cover all five HTML
 * metacharacters: without the single-quote escape, a room name
 * containing `'` flows into HTML attribute context unescaped.
 */

import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../standalone/app-log.js';

describe('escapeHtml (standalone/app-log.js)', () => {
  it('escapes &, <, >, ", and \'', () => {
    expect(escapeHtml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;');
  });

  it('returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('coerces non-strings', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});
