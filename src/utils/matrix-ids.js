/**
 * Derive a `via` routing hint from a bare room ID. Unlike aliases, room
 * IDs are not resolvable: /join only succeeds if the user's homeserver
 * already participates in the room, otherwise it 404s M_NOT_FOUND. The
 * ID's origin server is the best available hint (same heuristic Element
 * uses); it can be wrong if that server has since left the room.
 */
export function viaServersFor(idOrAlias) {
  if (typeof idOrAlias !== 'string' || !idOrAlias.startsWith('!')) return [];
  const sep = idOrAlias.indexOf(':');
  return sep > 0 ? [idOrAlias.slice(sep + 1)] : [];
}
