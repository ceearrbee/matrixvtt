/**
 * Table-roll chat format regression.
 *
 * The broadcast-to-chat string must not put a `:` after the bold
 * table name (`🎲 **Name**: text`): the trailing colon trips
 * client-side `:emoji:` autocomplete in some Matrix hosts, surfacing
 * an emoji picker the GM never asked for. A spaced hyphen separates
 * instead.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rollTable } from '../ui/tables/rollTable.js';
import { withFacade } from './helpers/withFacade.js';

function makeUi(tables) {
  const state = withFacade({
    isGM: () => true,
    tables: new Map(Object.entries(tables)),
    items: new Map(),
    sendStateEvent: vi.fn().mockResolvedValue({}),
  });
  const sent = [];
  return {
    state,
    _toast: vi.fn(),
    _log: vi.fn(),
    chat: {
      _send: vi.fn(msg => {
        sent.push(msg);
        return Promise.resolve();
      }),
    },
    _sent: sent,
  };
}

describe('rollTable chat broadcast format', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not include `**:` (which would trigger emoji autocomplete)', () => {
    const ui = makeUi({ 'tbl-1': { name: 'Loot', entries: [{ weight: 1, text: 'Old Boot' }] } });
    rollTable(ui, 'tbl-1');
    expect(ui._sent[0]).toBeDefined();
    expect(ui._sent[0]).not.toMatch(/\*\*:/);
    // Sanity: the entry text is still in the message.
    expect(ui._sent[0]).toContain('Old Boot');
    expect(ui._sent[0]).toContain('Loot');
  });

  it('surfaces a toast with the rolled result on every roll, regardless of item link', () => {
    const ui = makeUi({ 'tbl-1': { name: 'Local Rumors', entries: [{ weight: 1, text: 'A merchant swears the keep moans.' }] } });
    rollTable(ui, 'tbl-1');
    const calls = ui._toast.mock.calls;
    expect(calls.some(([msg]) => msg.includes('Local Rumors') && msg.includes('merchant swears'))).toBe(true);
  });
});
