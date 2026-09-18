/**
 * With a group selected, the action bar acts on the group.
 *
 * applyDamageToTokens had been written and left without a caller for
 * as long as selection could only hold one token. The bar names the
 * count so a GM never wonders how wide an action reaches.
 */

import { describe, it, expect, vi } from 'vitest';
import { buildTokenBarActions } from '../ui/token-bar-actions.js';

const token = { id: 'a', name: 'Goblin', hp_current: 7, hp_max: 7 };

const idsOf = (opts) => buildTokenBarActions(opts).map((a) => a.id);

describe('the bar with one token selected', () => {
  it('is unchanged', () => {
    expect(idsOf({ isGM: true, isOwner: false, token })).toEqual(
      ['sheet', 'damage', 'heal', 'condition', 'hide'],
    );
  });

  it('is unchanged when the selection explicitly holds just that token', () => {
    expect(idsOf({ isGM: true, isOwner: false, token, selectionSize: 1 })).toEqual(
      ['sheet', 'damage', 'heal', 'condition', 'hide'],
    );
  });
});

describe('the bar with a group selected', () => {
  const opts = { isGM: true, isOwner: false, token, selectionSize: 3 };

  it('drops the actions that only make sense for one token', () => {
    expect(idsOf(opts)).not.toContain('sheet');
  });

  it('offers damage, healing and conditions for the group', () => {
    expect(idsOf(opts)).toEqual(['damage', 'heal', 'condition']);
  });

  it('names how many tokens an action reaches', () => {
    const damage = buildTokenBarActions(opts).find((a) => a.id === 'damage');
    expect(damage.label).toMatch(/3/);
  });

  it('gives a player no group actions over tokens they do not own', () => {
    expect(idsOf({ isGM: false, isOwner: false, token, selectionSize: 3 })).toEqual([]);
  });

  it('routes group damage through the renderer with every id', () => {
    const ui = { mapRenderer: { showGroupDamageDialog: vi.fn() } };
    const damage = buildTokenBarActions(opts).find((a) => a.id === 'damage');
    damage.run(ui);
    expect(ui.mapRenderer.showGroupDamageDialog).toHaveBeenCalledWith('damage');
  });
});
