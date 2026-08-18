/**
 * src/map/input/token-drag.js - Konva-native token drag + preview.
 *
 * Each token's Konva.Group has `draggable: true` when the viewer can
 * move it. `dragmove` updates the local `token.col/row` (so visible
 * snap-feedback matches the legacy optimistic UX), and `dragend`
 * commits a single `state.updateTokenPosition`. Listener namespaces
 * (`'.tokenDrag'`) make the wiring idempotent - re-calling on the
 * same group cleanly replaces the prior bindings.
 *
 * Double-click / double-tap routes through `window.ui.previewToken`
 * so the same read-only preview popup the entity-list uses opens for
 * map tokens too. Single-click stays as the existing select-and-drag
 * affordance.
 */

import { showErrorNotification } from '../../utils/errorHandling.js';

const NS = '.tokenDrag';

export function enableTokenDrag(group, mr, tokenId) {
  const canMove = !!mr.state.canMoveToken?.(tokenId);

  // The tokens layer re-runs this for every visible token on every sync,
  // which is once per frame during a drag. Re-binding five listeners per
  // token per frame was pure waste, so skip when nothing changed.
  const bound = group._dragBinding;
  if (bound && bound.tokenId === tokenId && bound.canMove === canMove) return;
  group._dragBinding = { tokenId, canMove };

  group.off(`dragstart${NS} dragmove${NS} dragend${NS} dblclick${NS} dbltap${NS}`);

  // dblclick / dbltap → preview popup. Wired even when the viewer
  // can't move the token (a player viewing an NPC still gets the
  // preview), so this binding lives outside the canMove gate.
  const onDouble = () => window.ui?.previewToken?.(tokenId);
  group.on(`dblclick${NS}`, onDouble);
  group.on(`dbltap${NS}`, onDouble);

  group.draggable(canMove);
  if (!canMove) return;

  group.on(`dragstart${NS}`, () => {
    mr.draggedToken = tokenId;
    mr.isDragging = true;
  });

  group.on(`dragmove${NS}`, () => {
    const map = mr.state.map;
    if (!map) return;
    const px = map.cell_px;
    const t = mr.state.tokens.get(tokenId);
    if (!t) return;
    const size = t.size || 1;
    const col = clamp(
      Math.floor(group.x() / px - size / 2 + 0.5),
      0, Math.max(0, map.width_cells - size),
    );
    const row = clamp(
      Math.floor(group.y() / px - size / 2 + 0.5),
      0, Math.max(0, map.height_cells - size),
    );
    if (col !== t.col || row !== t.row) {
      t.col = col;
      t.row = row;
      mr.requestDragFrame();
    }
  });

  group.on(`dragend${NS}`, () => {
    const t = mr.state.tokens.get(tokenId);
    if (t) {
      mr.state.updateTokenPosition(tokenId, t.col, t.row).catch(showErrorNotification);
    }
    mr.draggedToken = null;
    mr.isDragging = false;
  });
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
