/**
 * The header connection chip should not go silent while reconnecting:
 * when writes are queued it reflects the same count the sync banner tracks,
 * so the highest-anxiety moment in a live session shows progress, not just
 * an inert "Reconnecting…".
 */
import { describe, it, expect } from 'vitest';
import { syncChipText } from '../ui/sync-chip.js';

describe('syncChipText', () => {
  it('shows Live when connected (queue ignored)', () => {
    expect(syncChipText(true, 0)).toBe('Live');
    expect(syncChipText(true, 5)).toBe('Live');
  });

  it('shows plain Reconnecting when nothing is queued', () => {
    expect(syncChipText(false, 0)).toBe('Reconnecting…');
  });

  it('reflects the queued-write count while reconnecting', () => {
    expect(syncChipText(false, 1)).toBe('Reconnecting · 1 queued');
    expect(syncChipText(false, 3)).toBe('Reconnecting · 3 queued');
  });
});
