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
 * Double-click / double-tap routes through `mr._ui.previewToken`
 * so the same read-only preview popup the entity-list uses opens for
 * map tokens too. Single-click stays as the existing select-and-drag
 * affordance.
 */

import { showErrorNotification } from '../../utils/errorHandling.js';
import { moveSelectionBy } from '../actions/move-selection.js';

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
  const onDouble = () => mr._ui?.previewToken?.(tokenId);
  group.on(`dblclick${NS}`, onDouble);
  group.on(`dbltap${NS}`, onDouble);

  group.draggable(canMove);
  if (!canMove) return;

  group.on(`dragstart${NS}`, () => {
    mr.draggedToken = tokenId;
    mr.isDragging = true;
    // Dragging a token that is part of a group carries the group. The
    // origin is recorded here so dragend can turn the dragged token's
    // travel into one delta for everyone else.
    const selection = mr.selectedTokenIds ?? new Set();
    const t = mr.state.tokens.get(tokenId);
    if (selection.size > 1 && selection.has(tokenId) && t) {
      const origins = [];
      for (const id of selection) {
        if (id === tokenId) continue;
        const other = mr.state.tokens.get(id);
        if (other) origins.push({ id, col: other.col, row: other.row });
      }
      mr._dragGroup = { origins, col: t.col, row: t.row };
    } else {
      mr._dragGroup = null;
    }
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
      // The rest of the group follows on screen while the drag is in
      // flight. These are local writes only, the same optimistic
      // feedback the dragged token gets; dragend does the committing.
      dragCarried(mr, col, row, map);
      mr.requestDragFrame();
    }
  });

  group.on(`dragend${NS}`, () => {
    const t = mr.state.tokens.get(tokenId);
    const carried = mr._dragGroup;
    mr._dragGroup = null;
    if (t) {
      mr.state.updateTokenPosition(tokenId, t.col, t.row).catch(showErrorNotification);
      if (carried) {
        const dCol = t.col - carried.col;
        const dRow = t.row - carried.row;
        if (dCol !== 0 || dRow !== 0) {
          // Roll each carried token back to where it started so the
          // writer sees a real move and its wall check has the right
          // origin to test against.
          const ids = [];
          for (const o of carried.origins) {
            const other = mr.state.tokens.get(o.id);
            if (!other) continue;
            other.col = o.col;
            other.row = o.row;
            ids.push(o.id);
          }
          moveSelectionBy(mr, ids, dCol, dRow).then(({ blocked }) => {
            if (blocked) mr._toast?.(`${blocked} token${blocked === 1 ? '' : 's'} blocked by a wall`, 'info');
          });
        }
      }
    }
    mr.draggedToken = null;
    mr.isDragging = false;
  });
}

/** Offset every carried token by the dragged token's travel so far. */
function dragCarried(mr, col, row, map) {
  const carried = mr._dragGroup;
  if (!carried) return;
  const dCol = col - carried.col;
  const dRow = row - carried.row;
  for (const o of carried.origins) {
    const other = mr.state.tokens.get(o.id);
    if (!other) continue;
    const size = other.size || 1;
    other.col = clamp(o.col + dCol, 0, Math.max(0, map.width_cells - size));
    other.row = clamp(o.row + dRow, 0, Math.max(0, map.height_cells - size));
  }
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
