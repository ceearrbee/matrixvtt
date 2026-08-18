/**
 * `toast(ui, message, type)` delegates to `sonner`. We pin the
 * delegation contract here:
 *
 *  - The right sonner method is called for each `type`.
 *  - The same (type, message) pair gets a stable `id` so sonner's
 *    own dedup collapses repeats into one visible toast.
 *  - Errors are sticky (duration: Infinity); other types auto-dismiss.
 *  - `_announce` fires for every call so screen-reader users hear the
 *    message even when the visible toast is being deduped.
 *
 * The visual deduplication, ARIA roles, and DOM structure are now
 * sonner's responsibility, not ours.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sonnerSpy = vi.hoisted(() => ({
  error: vi.fn(),
  warning: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
  default: vi.fn(),
}));

vi.mock('sonner', () => ({
  Toaster: () => null,
  toast: Object.assign((m, o) => sonnerSpy.default(m, o), sonnerSpy),
}));

import { toast } from '../ui/notifications.js';

function makeUi() { return { _announce: vi.fn() }; }

beforeEach(() => {
  document.body.innerHTML = '';
  for (const k of Object.keys(sonnerSpy)) sonnerSpy[k].mockClear();
});

describe('toast → sonner delegation', () => {
  it('routes errors to sonner.toast.error with sticky duration', () => {
    toast(makeUi(), 'Lost connection');
    expect(sonnerSpy.error).toHaveBeenCalledTimes(1);
    const [msg, opts] = sonnerSpy.error.mock.calls[0];
    expect(msg).toBe('Lost connection');
    expect(opts.duration).toBe(Infinity);
  });

  it('routes success / info / warning to the matching sonner method', () => {
    toast(makeUi(), 'Saved', 'success');
    toast(makeUi(), 'Heads up', 'info');
    toast(makeUi(), 'Careful', 'warning');
    expect(sonnerSpy.success).toHaveBeenCalledWith('Saved', expect.any(Object));
    expect(sonnerSpy.info).toHaveBeenCalledWith('Heads up', expect.any(Object));
    expect(sonnerSpy.warning).toHaveBeenCalledWith('Careful', expect.any(Object));
  });

  it('uses (type, message) as a stable sonner id so repeats collapse', () => {
    toast(makeUi(), 'Lost connection');
    toast(makeUi(), 'Lost connection');
    toast(makeUi(), 'Lost connection');
    // Sonner is called every time; we trust its own dedup against id.
    expect(sonnerSpy.error).toHaveBeenCalledTimes(3);
    const ids = sonnerSpy.error.mock.calls.map((c) => c[1].id);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe('error:Lost connection');
  });

  it('different types do NOT share an id with the same message', () => {
    toast(makeUi(), 'Saved', 'info');
    toast(makeUi(), 'Saved', 'error');
    const infoId = sonnerSpy.info.mock.calls[0][1].id;
    const errId  = sonnerSpy.error.mock.calls[0][1].id;
    expect(infoId).not.toBe(errId);
  });

  it('still announces every call to the screen-reader region', () => {
    const ui = makeUi();
    toast(ui, 'Lost connection');
    toast(ui, 'Lost connection');
    expect(ui._announce).toHaveBeenCalledTimes(2);
  });

  it('non-error types use a finite auto-dismiss duration', () => {
    toast(makeUi(), 'Saved', 'success');
    const opts = sonnerSpy.success.mock.calls[0][1];
    expect(Number.isFinite(opts.duration)).toBe(true);
  });
});
