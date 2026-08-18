/**
 * Pure action list for the contextual token bar. The bar shows the
 * selected token's most common actions; everything else stays in the
 * right-click menu. Kept DOM-free so tests exercise the permission
 * matrix directly.
 */

export function buildTokenBarActions({ isGM, isOwner, token }) {
  const actions = [{
    id: 'sheet',
    label: 'Sheet',
    run: (ui) => {
      window.dispatchEvent(new CustomEvent('vtt:view-sheet', { detail: { tokenId: token.id } }));
      void ui;
    },
  }];
  if (isGM || isOwner) {
    actions.push(
      { id: 'damage', label: 'Damage', run: (ui) => ui.mapRenderer?.showDamageDialog?.(token.id, 'damage') },
      { id: 'heal', label: 'Heal', run: (ui) => ui.mapRenderer?.showDamageDialog?.(token.id, 'heal') },
    );
  }
  if (isGM) {
    actions.push(
      { id: 'condition', label: 'Condition', run: (ui) => ui.mapRenderer?.showConditionDialog?.(token.id) },
      {
        id: 'hide',
        label: token.visible === false ? 'Show' : 'Hide',
        run: (ui) => ui.mapRenderer?.toggleTokenVisibility?.(token.id),
      },
    );
  }
  return actions;
}
