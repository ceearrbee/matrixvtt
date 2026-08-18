import { describe, it, expect } from 'vitest';
import { parseRoomTarget } from '../standalone/room-target.js';
import { buildInviteLink } from '../ui/invite-player.js';

describe('parseRoomTarget', () => {
  describe('raw identifiers', () => {
    it('accepts a room ID', () => {
      expect(parseRoomTarget('!abc:server.org')).toEqual({
        ok: true, target: '!abc:server.org', via: []
      });
    });

    it('accepts a room alias', () => {
      expect(parseRoomTarget('#campaign:server.org')).toEqual({
        ok: true, target: '#campaign:server.org', via: []
      });
    });

    it('trims surrounding whitespace', () => {
      expect(parseRoomTarget('  !abc:server.org \n')).toEqual({
        ok: true, target: '!abc:server.org', via: []
      });
    });

    it('accepts server names with ports', () => {
      expect(parseRoomTarget('!abc:server.org:8448').target).toBe('!abc:server.org:8448');
    });
  });

  describe('matrix.to links', () => {
    it('accepts a room-ID link', () => {
      expect(parseRoomTarget('https://matrix.to/#/!abc:server.org')).toEqual({
        ok: true, target: '!abc:server.org', via: []
      });
    });

    it('accepts an alias link', () => {
      expect(parseRoomTarget('https://matrix.to/#/#campaign:server.org')).toEqual({
        ok: true, target: '#campaign:server.org', via: []
      });
    });

    it('accepts URL-encoded room IDs and aliases', () => {
      expect(parseRoomTarget('https://matrix.to/#/%21abc%3Aserver.org').target)
        .toBe('!abc:server.org');
      expect(parseRoomTarget('https://matrix.to/#/%23campaign%3Aserver.org').target)
        .toBe('#campaign:server.org');
    });

    it('captures via servers', () => {
      expect(parseRoomTarget('https://matrix.to/#/!abc:server.org?via=one.org&via=two.org')).toEqual({
        ok: true, target: '!abc:server.org', via: ['one.org', 'two.org']
      });
    });

    it('ignores an event-ID path segment in message permalinks', () => {
      expect(parseRoomTarget('https://matrix.to/#/!abc:server.org/$evt123?via=one.org')).toEqual({
        ok: true, target: '!abc:server.org', via: ['one.org']
      });
    });

    it('accepts links without a scheme or with http', () => {
      expect(parseRoomTarget('matrix.to/#/!abc:server.org').ok).toBe(true);
      expect(parseRoomTarget('http://matrix.to/#/!abc:server.org').ok).toBe(true);
      expect(parseRoomTarget('https://www.matrix.to/#/!abc:server.org').ok).toBe(true);
    });

    it('round-trips links produced by buildInviteLink', () => {
      for (const target of ['!abc:server.org', '#campaign:server.org']) {
        expect(parseRoomTarget(buildInviteLink(target))).toEqual({ ok: true, target, via: [] });
      }
    });
  });

  describe('garbage input', () => {
    const cases = [
      '',
      '   ',
      'hello world',
      '@user:server.org',
      '!noserver',
      '#noserver',
      'https://example.com/#/!abc:server.org',
      'https://matrix.to/#/@user:server.org',
      'https://matrix.to/#/',
      'https://matrix.to/#/%E0%A4%A',
      null,
      undefined,
      42,
    ];

    for (const input of cases) {
      it(`rejects ${JSON.stringify(input)} with a friendly message`, () => {
        const result = parseRoomTarget(/** @type {any} */ (input));
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/room ID|alias|invite link/i);
      });
    }
  });
});
