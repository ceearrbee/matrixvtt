/**
 * ?join= deep link: a player who opens a MatrixVTT invite link is carried
 * through sign-in or registration and into the room, and the link is
 * stripped from the URL so a later reload does not re-trigger it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  readInviteFromUrl,
  savePendingInvite,
  loadPendingInvite,
  clearPendingInvite,
} from '../standalone/pending-invite.js';

const search = (qs) => /** @type {any} */ ({ search: qs });

describe('readInviteFromUrl', () => {
  it('reads a room ID with via hints', () => {
    expect(readInviteFromUrl(search('?join=%21room%3Ahs.example&via=hs.example')))
      .toEqual({ target: '!room:hs.example', via: ['hs.example'] });
  });

  it('accepts an alias and a pasted matrix.to link', () => {
    expect(readInviteFromUrl(search('?join=%23camp%3Ahs.example')))
      .toEqual({ target: '#camp:hs.example', via: [] });
    expect(readInviteFromUrl(search(`?join=${encodeURIComponent('https://matrix.to/#/!r%3Ahs.example?via=hs.example')}`)))
      .toEqual({ target: '!r:hs.example', via: ['hs.example'] });
  });

  it('ignores a missing or malformed target', () => {
    expect(readInviteFromUrl(search(''))).toBeNull();
    expect(readInviteFromUrl(search('?join=nonsense'))).toBeNull();
    expect(readInviteFromUrl(search('?join=javascript%3Aalert(1)'))).toBeNull();
  });
});

describe('pending invite storage', () => {
  beforeEach(() => sessionStorage.clear());

  it('round-trips and clears', () => {
    expect(loadPendingInvite()).toBeNull();
    savePendingInvite({ target: '!r:hs', via: ['hs'] });
    expect(loadPendingInvite()).toEqual({ target: '!r:hs', via: ['hs'] });
    clearPendingInvite();
    expect(loadPendingInvite()).toBeNull();
  });

  it('drops a stored record that no longer parses', () => {
    sessionStorage.setItem('vtt:pending-invite', JSON.stringify({ target: 'nonsense', via: [] }));
    expect(loadPendingInvite()).toBeNull();
  });

  it('survives storage being unavailable', () => {
    expect(() => savePendingInvite({ target: '!r:hs', via: [] }, null)).not.toThrow();
    expect(loadPendingInvite(null)).toBeNull();
  });
});
