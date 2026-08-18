/**
 * map-actions-wiring.js - attach token/fog/condition action forwards
 * to a MapRenderer instance. Each method is a thin forward to the
 * shared map action module; no logic lives here.
 */

import {
  toggleTokenVisibility, toggleTokenHPVisibility, removeToken, clearFacing,
  showAddTokenDialog,
} from './actions/tokens.js';
import {
  showDamageDialog, applyDamage, applyHealing, showConditionDialog,
  addCondition, removeCondition,
} from './actions/combat.js';
import {
  completeAreaSelection, toggleSingleFogCell, startAreaSelection,
} from './actions/fog.js';
import { showPinForm, showEditPinForm, removePin } from './actions/pins.js';
import { showMapContextMenu, showTokenContextMenu, showPinContextMenu } from './context-menus.js';
import { closeAllModals } from '../utils/modal-helpers.js';

function startFacingMode(mr, tokenId) {
  closeAllModals();
  mr._facingModeTokenId = tokenId;
  const c = mr.stage?.container?.() ?? mr.canvas;
  if (c?.style) c.style.cursor = 'crosshair';
  mr._toast?.('Click map to set facing direction', 'info');
}
function exitFacingMode(mr) {
  mr._facingModeTokenId = null;
  const c = mr.stage?.container?.() ?? mr.canvas;
  if (c?.style) c.style.cursor = 'default';
}
function closeContextMenu() {
  document.querySelectorAll('.context-menu').forEach((m) => m.remove());
}

export function attachMapActions(mr) {
  mr.toggleTokenVisibility   = (id)     => toggleTokenVisibility(mr, id);
  mr.toggleTokenHPVisibility = (id)     => toggleTokenHPVisibility(mr, id);
  mr.removeToken             = (id)     => removeToken(mr, id);
  mr._clearFacing            = (id)     => clearFacing(mr, id);
  mr.showDamageDialog        = (id, t)  => showDamageDialog(mr, id, t);
  mr.applyDamage             = (id, a)  => applyDamage(mr, id, a);
  mr.applyHealing            = (id, a)  => applyHealing(mr, id, a);
  mr.showConditionDialog     = (id)     => showConditionDialog(mr, id);
  mr.addCondition            = (id, c)  => addCondition(mr, id, c);
  mr.removeCondition         = (id, c)  => removeCondition(mr, id, c);
  mr.completeAreaSelection   = ()       => completeAreaSelection(mr);
  mr.startAreaSelection      = (m)      => startAreaSelection(mr, m);
  mr._toggleSingleFogCell    = (c, r)   => toggleSingleFogCell(mr, c, r);
  mr.showAddTokenDialog      = (c, r)   => showAddTokenDialog(mr, c, r);
  mr.closeContextMenu        = ()       => closeContextMenu();
  mr.showMapContextMenu      = (sx, sy, c, r) => showMapContextMenu(mr, sx, sy, c, r);
  mr.showTokenContextMenu    = (t, sx, sy)    => showTokenContextMenu(mr, t, sx, sy);
  mr.showPinContextMenu      = (p, sx, sy)    => showPinContextMenu(mr, p, sx, sy);
  mr.showPinForm             = (c, r)         => showPinForm(mr, c, r);
  mr.showEditPinForm         = (p)            => showEditPinForm(mr, p);
  mr.removePin               = (id)           => removePin(mr, id);
  mr._startFacingMode        = (id)     => startFacingMode(mr, id);
  mr._exitFacingMode         = ()       => exitFacingMode(mr);
}
