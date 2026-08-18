/**
 * M-key move mode must be a
 * documented, exported behavior - not a private flag. moveTokenBy is
 * the canonical helper for grid-snapped moves; keyboard.js delegates
 * to it so non-keyboard callers (mouse, mobile, scripts) share the
 * same code path.
 */
import { describe, it, expect, vi } from 'vitest';
import { moveTokenBy } from '../map/actions/tokens.js';

describe('moveTokenBy', () => {
  it('snaps to grid by adding integer dx/dy to col/row', async () => {
    const updateToken = vi.fn(async () => true);
    const tokens = new Map([['t1', { id: 't1', col: 3, row: 5, name: 'Aria' }]]);
    const mr = { state: { tokens, updateToken } };

    await moveTokenBy(mr, 't1', -1, 2);

    expect(updateToken).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ col: 2, row: 7 }),
    );
  });

  it('returns silently when the token is gone', async () => {
    const updateToken = vi.fn(async () => true);
    const mr = { state: { tokens: new Map(), updateToken } };
    await moveTokenBy(mr, 'missing', 1, 0);
    expect(updateToken).not.toHaveBeenCalled();
  });
});
