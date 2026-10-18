/**
 * The character write guard refused every player write to a character
 * they did not already own, and claiming is exactly that write, so no
 * player could claim a character.
 */
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { updateCharacter } from '../state/writers/entity-writers.js';

const PLAYER = '@player:hs';
const OTHER = '@other:hs';

function makeSm(character) {
  const doc = new Y.Doc();
  const charactersMap = doc.getMap('characters');
  charactersMap.set(character.id, character);
  return /** @type {any} */ ({
    userId: PLAYER,
    powerLevels: { users: { '@gm:hs': 100 }, users_default: 0 },
    characters: new Map([[character.id, character]]),
    tokens: new Map(),
    yjs: { doc, charactersMap, tokensMap: doc.getMap('tokens') },
  });
}

describe('a player writing a character', () => {
  it('may claim an unclaimed character', async () => {
    const aria = { id: 'chr-aria', name: 'Aria', claimed_by_user_id: null };
    const sm = makeSm(aria);
    await updateCharacter(sm, aria.id, { ...aria, claimed_by_user_id: PLAYER });
    expect(sm.yjs.charactersMap.get(aria.id).claimed_by_user_id).toBe(PLAYER);
  });

  it('may not edit an unclaimed character without claiming it', async () => {
    const aria = { id: 'chr-aria', name: 'Aria', claimed_by_user_id: null };
    const sm = makeSm(aria);
    await expect(updateCharacter(sm, aria.id, { ...aria, name: 'Renamed' })).rejects.toThrow(/Denied/);
  });

  it('may not take a character another player holds', async () => {
    const aria = { id: 'chr-aria', name: 'Aria', claimed_by_user_id: OTHER };
    const sm = makeSm(aria);
    await expect(updateCharacter(sm, aria.id, { ...aria, claimed_by_user_id: PLAYER })).rejects.toThrow(/Denied/);
  });
});
