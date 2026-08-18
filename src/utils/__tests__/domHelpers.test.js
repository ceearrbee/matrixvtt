import { describe, it, expect } from 'vitest';
import { esc } from '../domHelpers.js';

describe('esc', () => {
  it('escapes <', () => expect(esc('<')).toBe('&lt;'));
  it('escapes >', () => expect(esc('>')).toBe('&gt;'));
  it('escapes &', () => expect(esc('&')).toBe('&amp;'));
  it('escapes "', () => expect(esc('"')).toBe('&quot;'));
  it("escapes '", () => expect(esc("'")).toBe('&#39;'));
  it('escapes script tag', () => expect(esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;'));
  it('escapes onerror attribute', () => expect(esc('<img onerror=alert(1)>')).toBe('&lt;img onerror=alert(1)&gt;'));
  it('passes safe text unchanged', () => expect(esc('Hello World')).toBe('Hello World'));
  it('handles empty string', () => expect(esc('')).toBe(''));
  it('handles null', () => expect(esc(null)).toBe(''));
  it('handles undefined', () => expect(esc(undefined)).toBe(''));
  it('coerces numbers', () => expect(esc(42)).toBe('42'));
  it('coerces zero', () => expect(esc(0)).toBe('0'));
  it('escapes multiple entities in one string', () => expect(esc('a&b<c>d"e\'f')).toBe('a&amp;b&lt;c&gt;d&quot;e&#39;f'));
});

describe('esc - additional coercion and boundaries', () => {
  it('esc(false) → "false"', () => expect(esc(false)).toBe('false'));

  it('control characters: esc("\\x00\\x01\\x1f") - null bytes and control chars pass through unmodified', () => {
    // Control characters are not HTML special chars, so esc() leaves them alone
    const input = '\x00\x01\x1f';
    expect(esc(input)).toBe(input);
  });

  it('Mixed safe/unsafe: correctly escapes only the unsafe chars', () => {
    expect(esc('Hello <World> "test"')).toBe('Hello &lt;World&gt; &quot;test&quot;');
  });

  it('Double-escaping: esc(esc("<b>")) does not double-encode', () => {
    // First pass: '<b>' → '&lt;b&gt;'
    const once = esc('<b>');
    expect(once).toBe('&lt;b&gt;');
    // Second pass: '&lt;b&gt;' → '&amp;lt;b&amp;gt;' (& gets escaped again)
    const twice = esc(once);
    expect(twice).toBe('&amp;lt;b&amp;gt;');
    // This documents that double-escaping does occur - callers must not call esc twice
    expect(twice).not.toBe(once);
  });
});

describe('esc - pre-escaped and script-like input', () => {
  it('XSS bypass: already-escaped input &lt;script&gt; - esc does not decode it back', () => {
    const alreadyEscaped = '&lt;script&gt;alert(1)&lt;/script&gt;';
    const result = esc(alreadyEscaped);
    // The & in &lt; gets re-escaped to &amp;lt; - it does NOT produce a raw <script>
    expect(result).toContain('&amp;lt;');
    expect(result).not.toContain('<script>');
  });

  it('JSON injection: script-breaking sequence in string is escaped', () => {
    const dangerous = '{"key": "val</script><script>alert(1)"}';
    const result = esc(dangerous);
    expect(result).not.toContain('</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;/script&gt;');
  });
});
