/**
 * Keyboard token selection. Pure cycle order plus the screen-reader
 * announcement, kept out of the key-binding hook so both are testable
 * without a stage.
 */

export function cycleTokenId({ tokens, activeMapId, currentId, dir = 1, isVisible = null }) {
  const onMap = [...(tokens?.values?.() ?? [])]
    .filter((t) => t.map_id === activeMapId)
    .filter((t) => (isVisible ? isVisible(t) : true))
    .sort((a, b) => (a.row - b.row) || (a.col - b.col) || String(a.id).localeCompare(String(b.id)));
  if (onMap.length === 0) return null;
  const idx = onMap.findIndex((t) => t.id === currentId);
  if (idx === -1) return dir > 0 ? onMap[0].id : onMap[onMap.length - 1].id;
  return onMap[(idx + dir + onMap.length) % onMap.length].id;
}

export function announceTokenSelection(token) {
  const region = typeof document !== 'undefined'
    ? document.getElementById('vtt-sr-announcements')
    : null;
  if (!region || !token) return;
  region.textContent = `${token.name || 'Token'} selected. Press M to move, Escape to deselect.`;
}
