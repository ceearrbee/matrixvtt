/**
 * dice-command.js - parse `/roll` / `!r` / etc. from chat text,
 * execute the roll via the DiceRoller, and post the result back to
 * Matrix. The character-name resolver below consults the local
 * state manager to display the claimed-character's name rather
 * than the raw user id.
 */

const ROLL_COMMAND_PATTERNS = [
  /^\/roll\s+(.+)$/i,
  /^\/r\s+(.+)$/i,
  /^!roll\s+(.+)$/i,
  /^!r\s+(.+)$/i,
];

export function parseDiceRollCommand(message) {
  if (!message) return null;
  for (const pattern of ROLL_COMMAND_PATTERNS) {
    const match = message.match(pattern);
    if (match) return parseDiceNotation(match[1].trim());
  }
  return null;
}

/**
 * Validate dice notation. Accepts everything the engine roller supports:
 * NdS, NdS±M, NdF (FATE), NdS! (exploding), NdSw (OpenD6 wild die),
 * NdSr<N> (reroll), NdS(kh|kl|dh|dl)K, NdS>T / NdS>=T (success counting).
 *
 * Return shape preserves {count, sides, modifier, notation} for
 * back-compat with chat rendering. `sides` is 0 when the die is `F`.
 */
export function parseDiceNotation(notation) {
  // eslint-disable-next-line security/detect-unsafe-regex
  const match = notation.match(/^(\d+)d(f|\d+)(!)?w?(?:r\d+)?(?:(kh|kl|dh|dl)\d+)?(?:(>=|>)\d+)?([+-]\d+)?$/i);
  if (!match) return null;
  const sidesRaw = match[2].toLowerCase();
  return {
    count: parseInt(match[1], 10),
    sides: sidesRaw === 'f' ? 0 : parseInt(sidesRaw, 10),
    modifier: match[6] ? parseInt(match[6], 10) : 0,
    notation,
  };
}

export async function executeDiceRollFromChat(chat, rollCommand, sender) {
  const { notation } = rollCommand;
  const rollResult = chat.diceRoller.roll(notation);
  const { rolls, modifier, result: total } = rollResult;

  const rollsStr = rolls.join(', ');
  const modifierStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
  const result = modifier !== 0
    ? `**${total}** (${rollsStr} ${modifierStr})`
    : `**${total}** (${rollsStr})`;

  const characterName = getCharacterNameForUser(chat, sender);
  const speaker = characterName || sender.split(':')[0].substring(1);

  await chat._send(`🎲 ${speaker} rolled ${notation}: ${result}`);
}

export function getCharacterNameForUser(chat, userId) {
  if (!userId) return null;
  for (const [, character] of chat.state.characters.entries()) {
    if (character.claimed_by_user_id != null && character.claimed_by_user_id === userId) {
      return character.name;
    }
  }
  return null;
}
