/**
 * Layer visibility filter.
 *
 * Layers:
 *   'tokens' (default)  → visible to everyone
 *   'background'        → visible to everyone (render order hint only)
 *   'foreground'        → visible to everyone (render order hint only)
 *   'gm'                → visible only to GMs
 *   any other value     → treated as public (safe default for forward compat)
 */
export function visibleTokensForViewer(tokensMap, viewer) {
  const out = [];
  for (const token of tokensMap.values()) {
    if (token.layer === 'gm' && !viewer.isGM) continue;
    out.push(token);
  }
  return out;
}
