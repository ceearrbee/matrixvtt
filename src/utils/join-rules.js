/**
 * The join rules MatrixVTT offers a GM. Anything else (restricted,
 * knock_restricted, private) is left to a full Matrix client, so a
 * typo here never widens a room's access by accident.
 */

export const JOIN_RULE = {
  INVITE: 'invite',
  KNOCK: 'knock',
  PUBLIC: 'public',
};

const SETTABLE = [JOIN_RULE.INVITE, JOIN_RULE.KNOCK];

export function assertJoinRule(rule) {
  if (!SETTABLE.includes(rule)) {
    throw new Error(`Unsupported join rule: ${rule}`);
  }
}
