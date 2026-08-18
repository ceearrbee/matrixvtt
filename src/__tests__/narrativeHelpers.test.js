/**
 * Shared helpers for the generic narrative-section primitives.
 *
 * `substituteTemplate` and `isDisabled` are pure functions; this file
 * pins their contract before any primitive starts depending on them.
 */
import { describe, it, expect, vi } from 'vitest';
import { substituteTemplate, dispatchAnnounce } from '../ui/narrative/announce.js';
import { isDisabled } from '../ui/narrative/predicate.js';

describe('substituteTemplate', () => {
  it('replaces {actor}, {value}, {modifier} from vars', () => {
    const out = substituteTemplate('{actor} invokes [{value}] for +{modifier}', {
      actor: 'Aria', value: 'Trouble: hot-headed', modifier: 2,
    });
    expect(out).toBe('Aria invokes [Trouble: hot-headed] for +2');
  });

  it('passes unknown placeholders through literally', () => {
    expect(substituteTemplate('{actor} did {action}', { actor: 'X' })).toBe('X did {action}');
  });

  it('coerces non-string values to string', () => {
    expect(substituteTemplate('+{modifier}', { modifier: 2 })).toBe('+2');
  });

  it('returns the template unchanged when vars is missing', () => {
    expect(substituteTemplate('{actor}', null)).toBe('{actor}');
    expect(substituteTemplate('{actor}', undefined)).toBe('{actor}');
  });

  it('rejects template-string injection via the substituted value', () => {
    // A row value containing another placeholder must not recursively
    // substitute against vars - that would let user content steal the
    // {actor} slot. Single pass only.
    const out = substituteTemplate('{actor}: {value}', { actor: 'Hero', value: '{actor}' });
    expect(out).toBe('Hero: {actor}');
  });
});

describe('dispatchAnnounce', () => {
  it('calls ui.chat.announceMessage with the message when chat exposes it', async () => {
    const announceMessage = vi.fn().mockResolvedValue(undefined);
    const ui = { chat: { announceMessage } };
    await dispatchAnnounce(ui, 'Aria invokes [Trouble] for +2');
    expect(announceMessage).toHaveBeenCalledWith('Aria invokes [Trouble] for +2');
  });

  it('dispatches a local vtt:announce event when chat is unavailable', async () => {
    const handler = vi.fn();
    window.addEventListener('vtt:announce', handler);
    try {
      await dispatchAnnounce({ chat: null }, 'fallback');
      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].detail.message).toBe('fallback');
    } finally {
      window.removeEventListener('vtt:announce', handler);
    }
  });

  it('does not throw when neither chat nor window is wired (defensive)', async () => {
    await expect(dispatchAnnounce({}, 'x')).resolves.not.toThrow();
  });
});

describe('isDisabled', () => {
  it('returns false when no predicate is configured', () => {
    expect(isDisabled({ fate_points: 0 }, undefined)).toBe(false);
    expect(isDisabled({ fate_points: 0 }, null)).toBe(false);
  });

  it('disable_when_lte: field at threshold disables', () => {
    expect(isDisabled({ fate_points: 0 }, { field: 'fate_points', value: 0 })).toBe(true);
    expect(isDisabled({ fate_points: 0 }, { field: 'fate_points', value: 1 })).toBe(true);
    expect(isDisabled({ fate_points: 1 }, { field: 'fate_points', value: 0 })).toBe(false);
  });

  it('treats missing field as 0', () => {
    expect(isDisabled({}, { field: 'fate_points', value: 0 })).toBe(true);
  });

  it('coerces non-number values via Number()', () => {
    expect(isDisabled({ fate_points: '0' }, { field: 'fate_points', value: 0 })).toBe(true);
  });
});
