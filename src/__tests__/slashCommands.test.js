/**
 * slash-commands parser.
 *
 * Recognises rpglog-style command grammar at the start of an outgoing
 * chat body. The parser returns a discriminated union the send
 * pipeline (chat-send.js) routes on.
 *
 *   /w <user> <body>     → whisper
 *   /as <name> <body>    → say-mode, one-shot persona override
 *   /asd <name> <body>   → describe-mode, one-shot persona override
 *   /roll <formula>      → dispatch dice roll (no chat send)
 *   (anything else)      → plain
 *
 * Pure function - no signals, no DOM, no ui plumbing. Tested in
 * isolation so the routing fold in chat-send.js stays trivial.
 */
import { describe, it, expect } from 'vitest';
import { parseSlash } from '../ui/slash-commands.js';

describe('parseSlash - plain', () => {
  it('returns plain for a body without a leading slash', () => {
    expect(parseSlash('Hello there')).toEqual({ kind: 'plain', body: 'Hello there' });
  });

  it('returns plain when the leading slash does not match a known command', () => {
    expect(parseSlash('/lol something')).toEqual({ kind: 'plain', body: '/lol something' });
  });

  it('returns plain for an empty body', () => {
    expect(parseSlash('')).toEqual({ kind: 'plain', body: '' });
  });

  it('trims a leading-newline body the same way (returns plain)', () => {
    expect(parseSlash('\nhello')).toEqual({ kind: 'plain', body: '\nhello' });
  });
});

describe('parseSlash - /w whisper', () => {
  it('parses /w @user body', () => {
    expect(parseSlash('/w @sarah hush')).toEqual({
      kind: 'whisper', toUser: '@sarah', body: 'hush',
    });
  });

  it('parses /W as case-insensitive', () => {
    expect(parseSlash('/W @sarah hush')).toEqual({
      kind: 'whisper', toUser: '@sarah', body: 'hush',
    });
  });

  it('preserves the rest of the body verbatim including spaces', () => {
    expect(parseSlash('/w @bob   the  big news')).toEqual({
      kind: 'whisper', toUser: '@bob', body: 'the  big news',
    });
  });

  it('/w with no body falls back to plain', () => {
    expect(parseSlash('/w @sarah')).toEqual({ kind: 'plain', body: '/w @sarah' });
  });
});

describe('parseSlash - /as one-shot persona (say)', () => {
  it('parses /as Name body', () => {
    expect(parseSlash('/as Bartender Welcome, traveller.')).toEqual({
      kind: 'as', personaName: 'Bartender', body: 'Welcome, traveller.',
    });
  });

  it('case-insensitive on the command token', () => {
    expect(parseSlash('/AS Bartender hi')).toEqual({
      kind: 'as', personaName: 'Bartender', body: 'hi',
    });
  });

  it('does NOT match /asd as /as (longer command wins)', () => {
    const r = parseSlash('/asd Bartender bows.');
    expect(r.kind).toBe('asd');
  });

  it('/as with no body falls back to plain', () => {
    expect(parseSlash('/as Bartender')).toEqual({ kind: 'plain', body: '/as Bartender' });
  });

  it('persona name may contain a single internal space when quoted', () => {
    expect(parseSlash('/as "Old Knight" The road is dark.')).toEqual({
      kind: 'as', personaName: 'Old Knight', body: 'The road is dark.',
    });
  });
});

describe('parseSlash - /asd one-shot persona (describe)', () => {
  it('parses /asd Name body', () => {
    expect(parseSlash('/asd Bartender bows behind the counter.')).toEqual({
      kind: 'asd', personaName: 'Bartender', body: 'bows behind the counter.',
    });
  });

  it('/asd with no body falls back to plain', () => {
    expect(parseSlash('/asd Bartender')).toEqual({ kind: 'plain', body: '/asd Bartender' });
  });
});

describe('parseSlash - /roll', () => {
  it('parses /roll 1d20+3', () => {
    expect(parseSlash('/roll 1d20+3')).toEqual({ kind: 'roll', formula: '1d20+3' });
  });

  it('accepts /r as an alias', () => {
    expect(parseSlash('/r 1d20+3')).toEqual({ kind: 'roll', formula: '1d20+3' });
  });

  it('preserves the full formula including spaces and labels', () => {
    expect(parseSlash('/roll 2d20kh1 + STR  attack')).toEqual({
      kind: 'roll', formula: '2d20kh1 + STR  attack',
    });
  });

  it('/roll with no formula falls back to plain', () => {
    expect(parseSlash('/roll')).toEqual({ kind: 'plain', body: '/roll' });
  });
});
