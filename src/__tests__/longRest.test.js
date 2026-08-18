/**
 * Long rest - applyLongRest
 *
 * A long rest restores: all spell slots to max, HP to max.
 * Short rest: restores hit dice (not implemented here; long rest only for now).
 */

import { describe, it, expect, vi } from 'vitest';
import { applyLongRest } from '../ui/gm-ops.js';
import { EVENT_TYPES } from '../utils/constants.js';
import { withFacade } from './helpers/withFacade.js';

function makeUi({ character, charId = 'char-1' } = {}) {
  const chars = new Map([[charId, character]]);
  return {
    state: withFacade({
      characters: chars,
      getCurrentCharacterId: () => charId,
      getCurrentCharacter: () => chars.get(charId),
      sendStateEvent: vi.fn().mockResolvedValue(undefined),
    }),
    _log: vi.fn(),
    _toast: vi.fn(),
  };
}

describe('applyLongRest', () => {
  it('restores all spell slots to max', async () => {
    const character = {
      name: 'Aria',
      hp_current: 10, hp_max: 30,
      spell_slots: {
        '1': { total: 4, used: 3 },
        '2': { total: 3, used: 2 },
      },
    };
    const ui = makeUi({ character });
    await applyLongRest(ui);
    const updated = ui.state.characters.get('char-1');
    expect(updated.spell_slots['1'].used).toBe(0);
    expect(updated.spell_slots['2'].used).toBe(0);
  });

  it('restores HP to max', async () => {
    const character = { name: 'Aria', hp_current: 5, hp_max: 30, spell_slots: {} };
    const ui = makeUi({ character });
    await applyLongRest(ui);
    expect(ui.state.characters.get('char-1').hp_current).toBe(30);
  });

  it('sends state event with updated character', async () => {
    const character = { name: 'Aria', hp_current: 10, hp_max: 30, spell_slots: {} };
    const ui = makeUi({ character });
    await applyLongRest(ui);
    expect(ui.state.sendStateEvent).toHaveBeenCalledWith(EVENT_TYPES.CHARACTER, 'char-1', expect.objectContaining({ hp_current: 30 }));
  });

  it('logs a rest message', async () => {
    const character = { name: 'Aria', hp_current: 30, hp_max: 30, spell_slots: {} };
    const ui = makeUi({ character });
    await applyLongRest(ui);
    expect(ui._log).toHaveBeenCalledWith('😴', expect.stringContaining('long rest'));
  });

  it('does nothing when no character is selected', async () => {
    const ui = makeUi({ character: undefined, charId: 'char-1' });
    ui.state.getCurrentCharacter = () => null;
    await applyLongRest(ui);
    expect(ui.state.sendStateEvent).not.toHaveBeenCalled();
  });
});
