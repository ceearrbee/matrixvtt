/**
 * A `?join=` invite has to survive the detour a player takes to create
 * a Matrix account elsewhere (matrix.org needs a CAPTCHA this app
 * cannot run, so the register panel sends them to element.io). A
 * sessionStorage park died with the tab and dropped the invite
 * silently; localStorage survives, bounded by a short expiry so an
 * unused invite doesn't ambush the player weeks later.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  savePendingInvite, loadPendingInvite, clearPendingInvite, readInviteFromUrl,
  PENDING_INVITE_TTL_MS,
} from '../standalone/pending-invite.js';

const INVITE = { target: '!room:hs', via: ['hs'] };

describe('pending invite storage', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  afterEach(() => { vi.useRealTimers(); });

  it('defaults to localStorage so a new tab still has the invite', () => {
    savePendingInvite(INVITE);
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(1);
    expect(loadPendingInvite()).toEqual(INVITE);
  });

  it('forgets an invite older than the expiry window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-07T10:00:00Z'));
    savePendingInvite(INVITE);
    vi.setSystemTime(new Date('2026-09-07T10:00:00Z').getTime() + PENDING_INVITE_TTL_MS + 1000);
    expect(loadPendingInvite()).toBeNull();
  });

  it('keeps an invite parked inside the window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-07T10:00:00Z'));
    savePendingInvite(INVITE);
    vi.advanceTimersByTime(PENDING_INVITE_TTL_MS - 1000);
    expect(loadPendingInvite()).toEqual(INVITE);
  });

  it('clears from localStorage', () => {
    savePendingInvite(INVITE);
    clearPendingInvite();
    expect(loadPendingInvite()).toBeNull();
  });
});

describe('readInviteFromUrl', () => {
  it('returns the parsed invite for a usable target', () => {
    const out = readInviteFromUrl({ search: '?join=%23game%3Ahs&via=hs' });
    expect(out.invite.target).toBe('#game:hs');
    expect(out.error).toBe('');
  });

  it('explains an unusable target instead of dropping it silently', () => {
    const out = readInviteFromUrl({ search: '?join=not-a-room' });
    expect(out.invite).toBeNull();
    expect(out.error).toMatch(/not-a-room/);
    expect(out.error.length).toBeGreaterThan(20);
  });

  it('reports neither invite nor error when there is no join parameter', () => {
    const out = readInviteFromUrl({ search: '' });
    expect(out).toEqual({ invite: null, error: '' });
  });
});
