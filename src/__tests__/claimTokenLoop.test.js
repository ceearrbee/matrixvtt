/**
 * Character claim/unclaim token loop resilience (character-manager.js).
 *
 * When a player has multiple PC tokens linked to a character, and one token
 * send fails during claim/unclaim, the loop must:
 *  - not abort - attempt all tokens
 *  - show a toast listing how many failed, not just the first error
 *
 * UI rerenders happen automatically via the facade write → syncer →
 * signals path now; there is no manual window.dispatchEvent step to
 * assert.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { claimCharacter, unclaimCharacter } from '../ui/entity-manager.js';
import * as errorHandling from '../utils/errorHandling.js';

vi.mock('../utils/ui-helpers.js', () => ({
  FormReader: vi.fn(),
}));

// claimCharacter routes through confirm-dialogs.confirm now; auto-accept
// so the underlying token-sync loop runs.
vi.mock('../ui/confirm-dialogs.jsx', () => ({
  confirm: (msg, onConfirm) => { onConfirm(); },
  confirmAsync: (msg, onConfirm) => { onConfirm(); },
  confirmTyped: (msg, phrase, onConfirm) => { onConfirm(); },
}));

function makeUi({ charId = 'char1', tokens = [], sendResults = [] } = {}) {
  let sendIndex = 0;
  const sendStateEvent = vi.fn().mockImplementation(() => {
    const result = sendResults[sendIndex++];
    return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
  });

  const character = { name: 'Test Char', claimed_by_user_id: null };
  const tokenMap = new Map(tokens.map(([id, t]) => [id, { ...t }]));

  const state = {
    isGM: () => false,
    characters: new Map([[charId, character]]),
    tokens: tokenMap,
    selectedCharacterId: null,
    sendStateEvent,
    canEditEntity: () => true,
  };
  state.updateCharacter = async (id, c) => { state.characters.set(id, c); return sendStateEvent('com.vtt.character', id, c); };
  state.updateToken = async (id, t) => { state.tokens.set(id, t); return sendStateEvent('com.vtt.token', id, t); };
  return {
    state,
    widgetManager: { userId: '@player:example.com' },
    _toast: vi.fn(),
    _syncDisplayName: vi.fn(),
    updateSheetPanel: vi.fn(),
  };
}

describe('claimCharacter token loop', () => {
  it('attempts all tokens even when the second send fails', async () => {
    const ui = makeUi({
      tokens: [
        ['tok1', { sheet_id: 'char1', type: 'pc', owner_user_id: null }],
        ['tok2', { sheet_id: 'char1', type: 'pc', owner_user_id: null }],
      ],
      // char send succeeds, tok1 succeeds, tok2 fails
      sendResults: [undefined, undefined, new Error('net')],
    });

    await claimCharacter(ui, 'char1');
    // Allow async callback to finish
    await new Promise(resolve => setTimeout(resolve, 0));

    // Both tokens were attempted (plus the character send)
    expect(ui.state.sendStateEvent).toHaveBeenCalledTimes(3);
  });

  it('shows a toast when one token send fails during claim', async () => {
    const ui = makeUi({
      tokens: [
        ['tok1', { sheet_id: 'char1', type: 'pc', owner_user_id: null }],
        ['tok2', { sheet_id: 'char1', type: 'pc', owner_user_id: null }],
      ],
      sendResults: [undefined, undefined, new Error('net')],
    });

    await claimCharacter(ui, 'char1');
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(ui._toast).toHaveBeenCalled();
  });

  it('persists the character claim even when a token send fails', async () => {
    const ui = makeUi({
      tokens: [
        ['tok1', { sheet_id: 'char1', type: 'pc', owner_user_id: null }],
      ],
      // char send succeeds, token send fails
      sendResults: [undefined, new Error('net')],
    });

    await claimCharacter(ui, 'char1');
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(ui.state.characters.get('char1').claimed_by_user_id).toBe('@player:example.com');
  });
});

describe('unclaimCharacter token loop', () => {
  it('attempts all tokens even when one fails during unclaim', async () => {
    const ui = makeUi({
      tokens: [
        ['tok1', { sheet_id: 'char1', type: 'pc', owner_user_id: '@player:example.com' }],
        ['tok2', { sheet_id: 'char1', type: 'pc', owner_user_id: '@player:example.com' }],
      ],
      // char send succeeds, tok1 fails, tok2 succeeds
      sendResults: [undefined, new Error('net'), undefined],
    });
    ui.state.characters.get('char1').claimed_by_user_id = '@player:example.com';

    await unclaimCharacter(ui, 'char1');

    expect(ui.state.sendStateEvent).toHaveBeenCalledTimes(3);
  });

  it('shows toast when token send fails during unclaim', async () => {
    const ui = makeUi({
      tokens: [
        ['tok1', { sheet_id: 'char1', type: 'pc', owner_user_id: '@player:example.com' }],
      ],
      sendResults: [undefined, new Error('net')],
    });
    ui.state.characters.get('char1').claimed_by_user_id = '@player:example.com';

    await unclaimCharacter(ui, 'char1');

    expect(ui._toast).toHaveBeenCalled();
  });
});
