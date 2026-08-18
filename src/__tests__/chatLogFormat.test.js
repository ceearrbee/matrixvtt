/**
 * Persona-prefix wire format + log dedup helpers.
 */
import { describe, it, expect } from 'vitest';
import {
  prefixBodyWithPersona,
  bodyAlreadyPrefixed,
  formatSayLogBody,
  formatEmoteLogBody,
} from '../ui/chat-log-format.js';

describe('prefixBodyWithPersona', () => {
  it('Say with persona: `Sora: <tone-body>`', () => {
    expect(prefixBodyWithPersona('[Cheerful] Hi', 'Sora', 'say'))
      .toBe('Sora: [Cheerful] Hi');
  });

  it('Describe with persona: `Sora <verb>`', () => {
    expect(prefixBodyWithPersona('leans against the wall', 'Sora', 'describe'))
      .toBe('Sora leans against the wall');
  });

  it('OOC drops persona regardless', () => {
    expect(prefixBodyWithPersona('pizza in 5', 'Sora', 'ooc')).toBe('pizza in 5');
  });

  it('No persona name → body unchanged', () => {
    expect(prefixBodyWithPersona('hi', null, 'say')).toBe('hi');
    expect(prefixBodyWithPersona('hi', '', 'say')).toBe('hi');
  });
});

describe('bodyAlreadyPrefixed', () => {
  it('say: matches `Sora: …`', () => {
    expect(bodyAlreadyPrefixed('Sora: Hi', 'Sora', 'say')).toBe(true);
    expect(bodyAlreadyPrefixed('Hi', 'Sora', 'say')).toBe(false);
  });

  it('describe: matches `Sora …`', () => {
    expect(bodyAlreadyPrefixed('Sora leans', 'Sora', 'describe')).toBe(true);
    expect(bodyAlreadyPrefixed('leans', 'Sora', 'describe')).toBe(false);
  });

  it('ooc: never matches', () => {
    expect(bodyAlreadyPrefixed('Sora: Hi', 'Sora', 'ooc')).toBe(false);
  });
});

describe('formatSayLogBody', () => {
  it('persona-prefixed body uses the body verbatim (no displayName prepend)', () => {
    const out = formatSayLogBody('Sora', 'Sora: [Alarmed] Whoah!', 'Sora');
    expect(out).toBe('Sora: [Alarmed] Whoah!');
  });

  it('non-prefixed body falls back to `<b>name</b>: body`', () => {
    const out = formatSayLogBody('Aria', 'hi', null);
    expect(out).toBe('<b>Aria</b>: hi');
  });

  it('escapes HTML in the body', () => {
    const out = formatSayLogBody('Aria', '<script>x</script>', null);
    expect(out).not.toContain('<script>');
  });
});

describe('formatEmoteLogBody', () => {
  it('persona-embedded body → `* <body>`', () => {
    const out = formatEmoteLogBody('Sora', 'Sora leans', 'Sora');
    expect(out).toBe('<i>* Sora leans</i>');
  });

  it('non-prefixed body falls back to `* <b>name</b> body`', () => {
    const out = formatEmoteLogBody('Aria', 'waves', null);
    expect(out).toBe('<i>* <b>Aria</b> waves</i>');
  });
});
