/**
 * Normalizes join-field input into a joinable Matrix target: a raw room
 * ID, a room alias, or a matrix.to invite link (optionally URL-encoded,
 * optionally carrying ?via= routing hints).
 */

const ROOM_ID_PATTERN = /^![^:\s]+:\S+$/;
const ALIAS_PATTERN = /^#[^:\s]+:\S+$/;
// eslint-disable-next-line security/detect-unsafe-regex -- anchored, optional literal prefixes plus one greedy capture; no nested quantifiers
const MATRIX_TO_PATTERN = /^(?:https?:\/\/)?(?:www\.)?matrix\.to\/#\/(.+)$/i;

const FAILURE = Object.freeze({
  ok: false,
  error: 'Enter a room ID (!room:server.org), an alias (#room:server.org), or a matrix.to invite link.'
});

function isJoinableTarget(value) {
  return ROOM_ID_PATTERN.test(value) || ALIAS_PATTERN.test(value);
}

/**
 * @typedef {{ ok: true, target: string, via: string[] }} RoomTargetSuccess
 * @typedef {{ ok: false, error: string }} RoomTargetFailure
 */

/**
 * @param {unknown} input
 * @returns {RoomTargetSuccess | RoomTargetFailure}
 */
export function parseRoomTarget(input) {
  if (typeof input !== 'string') return FAILURE;
  const raw = input.trim();
  if (isJoinableTarget(raw)) return { ok: true, target: raw, via: [] };

  const match = raw.match(MATRIX_TO_PATTERN);
  if (!match) return FAILURE;

  const [path, query = ''] = match[1].split('?');
  let target;
  try {
    target = decodeURIComponent(path.split('/')[0]);
  } catch {
    return FAILURE;
  }
  if (!isJoinableTarget(target)) return FAILURE;

  const via = new URLSearchParams(query).getAll('via').filter(Boolean);
  return { ok: true, target, via };
}
