/**
 * chat-tones - preset tone list + body prefix helper.
 *
 * The wire format prefixes a tone-tagged say with `[ToneName] body`; an
 * accompanying `com.vtt.tone` field can carry colour metadata but is not
 * authoritative for the rendered text. Neutral is a no-op.
 */
import { describe, it, expect } from 'vitest';
import { CHAT_TONES, formatToneBody } from '../ui/chat-tones.js';

describe('CHAT_TONES list', () => {
  it('Neutral sits at index 0', () => {
    expect(CHAT_TONES[0].name).toBe('Neutral');
  });

  it('has at least 40 preset tones (rolegate-style list)', () => {
    expect(CHAT_TONES.length).toBeGreaterThanOrEqual(40);
  });

  it('every entry has a non-empty name', () => {
    for (const t of CHAT_TONES) {
      expect(typeof t.name).toBe('string');
      expect(t.name.length).toBeGreaterThan(0);
    }
  });

  it('names are unique', () => {
    const names = CHAT_TONES.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('formatToneBody', () => {
  it('returns the body unchanged when tone is null', () => {
    expect(formatToneBody(null, 'hello')).toBe('hello');
  });

  it('returns the body unchanged for Neutral tone', () => {
    expect(formatToneBody({ name: 'Neutral' }, 'hello')).toBe('hello');
  });

  it('prefixes [Name] for any non-Neutral tone', () => {
    expect(formatToneBody({ name: 'Cheerful' }, 'hi there')).toBe('[Cheerful] hi there');
  });

  it('preserves the body verbatim - no HTML escaping; the consumer escapes', () => {
    expect(formatToneBody({ name: 'Angry' }, '<b>hey</b>')).toBe('[Angry] <b>hey</b>');
  });

  it('handles custom tones (color metadata ignored in body)', () => {
    expect(formatToneBody({ name: 'Smug', color: '#ff00ff' }, 'mhm'))
      .toBe('[Smug] mhm');
  });
});
