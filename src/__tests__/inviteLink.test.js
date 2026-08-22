/**
 * Invite link builders: the MatrixVTT player link players open directly,
 * the matrix.to link for people who already run a Matrix client, and the
 * paste-ready share message the GM drops into chat.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  appJoinLink,
  buildInviteLink,
  buildShareMessage,
  roomInviteLinks,
} from '../ui/invite-link.js';
import { parseRoomTarget } from '../standalone/room-target.js';

const OPTS = { origin: 'https://vtt.example', base: '/matrixvtt/' };

describe('appJoinLink', () => {
  it('points at app.html under the configured base with the encoded target', () => {
    expect(appJoinLink('!room:hs.example', ['hs.example'], OPTS))
      .toBe('https://vtt.example/matrixvtt/app.html?join=%21room%3Ahs.example&via=hs.example');
  });

  it('handles a root base and a base missing its trailing slash', () => {
    expect(appJoinLink('#camp:hs.example', [], { origin: 'https://vtt.example', base: '/' }))
      .toBe('https://vtt.example/app.html?join=%23camp%3Ahs.example');
    expect(appJoinLink('#camp:hs.example', [], { origin: 'https://vtt.example', base: '/vtt' }))
      .toBe('https://vtt.example/vtt/app.html?join=%23camp%3Ahs.example');
  });

  it('carries every via hint', () => {
    expect(appJoinLink('!r:a.example', ['a.example', 'b.example'], OPTS))
      .toBe('https://vtt.example/matrixvtt/app.html?join=%21r%3Aa.example&via=a.example&via=b.example');
  });

  it('round-trips through the join-field parser', () => {
    const link = appJoinLink('!room:hs.example', ['hs.example'], OPTS);
    const join = new URL(link).searchParams.get('join');
    expect(parseRoomTarget(join)).toEqual({ ok: true, target: '!room:hs.example', via: [] });
  });

  it('returns null without a target', () => {
    expect(appJoinLink('', [], OPTS)).toBeNull();
    expect(appJoinLink(null, [], OPTS)).toBeNull();
  });
});

describe('buildShareMessage', () => {
  it('names the session and leads with the player link', () => {
    const msg = buildShareMessage({ roomName: 'Curse of Strahd', playerLink: 'https://vtt.example/app.html?join=x' });
    expect(msg).toContain('Curse of Strahd');
    expect(msg).toContain('https://vtt.example/app.html?join=x');
    expect(msg).toMatch(/create a free one/i);
  });

  it('falls back to a generic name', () => {
    expect(buildShareMessage({ playerLink: 'https://vtt.example/x' })).toMatch(/MatrixVTT/);
  });
});

describe('roomInviteLinks', () => {
  it('builds both links from one room-state read, preferring the canonical alias', async () => {
    const manager = {
      roomId: '!room:hs.example',
      getRoomState: vi.fn().mockResolvedValue([
        { type: 'm.room.canonical_alias', content: { alias: '#camp:hs.example' } },
      ]),
    };
    const links = await roomInviteLinks(manager, OPTS);
    expect(manager.getRoomState).toHaveBeenCalledTimes(1);
    expect(links).toEqual({
      target: '#camp:hs.example',
      via: [],
      playerLink: 'https://vtt.example/matrixvtt/app.html?join=%23camp%3Ahs.example',
      matrixToLink: buildInviteLink('#camp:hs.example'),
    });
  });

  it('falls back to the room ID with a via hint when state reads fail', async () => {
    const manager = { roomId: '!room:hs.example', getRoomState: vi.fn().mockRejectedValue(new Error('403')) };
    const links = await roomInviteLinks(manager, OPTS);
    expect(links.target).toBe('!room:hs.example');
    expect(links.via).toEqual(['hs.example']);
    expect(links.playerLink).toContain('join=%21room%3Ahs.example&via=hs.example');
    expect(links.matrixToLink).toBe('https://matrix.to/#/!room%3Ahs.example?via=hs.example');
  });

  it('returns null when there is no room at all', async () => {
    expect(await roomInviteLinks({ roomId: null, getRoomState: vi.fn().mockResolvedValue([]) }, OPTS)).toBeNull();
  });
});
