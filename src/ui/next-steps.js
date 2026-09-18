/**
 * next-steps.js - what the checklist should show, derived from room
 * state. Pure and DOM-free so the panel stays a thin renderer.
 *
 * Each step ticks itself from state the room already carries, so the
 * list empties as the table comes together instead of needing a
 * "mark as done" the user has to maintain.
 *
 * A step can also be waiting on an earlier one: you cannot place a
 * token without a map, or roll initiative without tokens. Such a step
 * carries `blockedBy`, and the panel runs the blocking step instead of
 * an action that could only fail. A step that is already done is never
 * blocked - progress reads even if its prerequisite later went away.
 */

export const NEXT_STEP_KEYS = Object.freeze({
  MAP: 'map',
  INVITE: 'invite',
  TOKEN: 'token',
  COMBAT: 'combat',
  CHARACTER: 'character',
});

// A blank campaign seeds one placeholder map with no image, so a map
// only counts once it has artwork on it.
function hasRealMap(maps) {
  for (const map of maps?.values?.() ?? []) {
    if (map?.image_url) return true;
  }
  return false;
}

function ownsACharacter(characters, myUserId) {
  if (!myUserId) return false;
  for (const c of characters?.values?.() ?? []) {
    if (c?.player_user_id === myUserId || c?.claimed_by_user_id === myUserId) return true;
  }
  return false;
}

// A sheet the GM prepared and nobody has taken yet. Only then is
// "claim" a promise the app can keep.
function hasUnclaimedCharacter(characters) {
  for (const c of characters?.values?.() ?? []) {
    if (!c?.player_user_id && !c?.claimed_by_user_id) return true;
  }
  return false;
}

/**
 * @param {object} room
 * @param {boolean} room.isGM
 * @param {number} room.memberCount
 * @param {Map<string, any>} room.maps
 * @param {Map<string, any>} room.tokens
 * @param {Map<string, any>} room.characters
 * @param {{active?: boolean, order?: any[]}} room.initiative
 * @param {string|null} room.myUserId
 * @returns {{key: string, label: string, hint: string, done: boolean, blockedBy: string|null, action?: string}[]}
 */
export function nextStepsFor({
  isGM, memberCount = 1, maps, tokens, characters, initiative, myUserId,
}) {
  if (!isGM) {
    const canClaim = hasUnclaimedCharacter(characters);
    return [{
      key: NEXT_STEP_KEYS.CHARACTER,
      action: canClaim ? 'claim' : 'create',
      label: canClaim ? 'Claim your character' : 'Make your character',
      hint: canClaim
        ? 'Open the party roster and take the sheet your GM prepared for you.'
        : 'Nobody has left you a sheet yet, so build one of your own.',
      done: ownsACharacter(characters, myUserId),
      blockedBy: null,
    }];
  }

  const mapDone = hasRealMap(maps);
  const tokenDone = (tokens?.size ?? 0) > 0;
  const combatDone = !!initiative?.active || (initiative?.order?.length ?? 0) > 0;

  return [
    {
      key: NEXT_STEP_KEYS.MAP,
      label: 'Add a map',
      hint: 'Upload the battle map your players will see.',
      done: mapDone,
      blockedBy: null,
    },
    {
      key: NEXT_STEP_KEYS.INVITE,
      label: 'Invite players',
      hint: 'Copy the link that walks a player through signing in and joining.',
      done: memberCount > 1,
      blockedBy: null,
    },
    step({
      key: NEXT_STEP_KEYS.TOKEN,
      label: 'Add a token',
      hint: 'Put a character or monster on the map.',
      done: tokenDone,
      blockedBy: mapDone ? null : NEXT_STEP_KEYS.MAP,
    }),
    step({
      key: NEXT_STEP_KEYS.COMBAT,
      label: 'Start combat',
      hint: 'Roll initiative when the first fight breaks out.',
      done: combatDone,
      blockedBy: tokenDone ? null : NEXT_STEP_KEYS.TOKEN,
    }),
  ];
}

const WAITING_HINTS = Object.freeze({
  [NEXT_STEP_KEYS.MAP]: 'Add a map first, then put a character or monster on it.',
  [NEXT_STEP_KEYS.TOKEN]: 'Add a token first, so there is somebody to roll for.',
});

// A done step is never blocked, so progress still reads if its
// prerequisite later went away; a blocked one says what it waits for.
function step({ key, label, hint, done, blockedBy }) {
  const waiting = done ? null : blockedBy;
  return { key, label, hint: waiting ? WAITING_HINTS[waiting] : hint, done, blockedBy: waiting };
}
