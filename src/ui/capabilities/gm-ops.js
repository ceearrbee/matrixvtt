/**
 * gm-ops.js - narrow capability object consumed by the GM sidebar tab
 * sub-panels (`src/ui/gm/panels/*`). Bundles the fog / bulk-heal / NPC-template
 * / long-rest surface the GM UI touches, so those components don't
 * have to receive the whole `ui` controller.
 *
 * New GM features should add methods here (or to a sibling ops
 * object) rather than accrete onto `ui`.
 */

export function createGMOps(ui) {
  return {
    toggleFog()          { return ui.toggleFog(); },
    revealAllFog()       { return ui.revealAllFog(); },
    hideAllFog()         { return ui.hideAllFog(); },
    healAll()            { return ui.healAll(); },
    clearAllConditions() { return ui.clearAllConditions(); },
    adjustXP(id, delta)  { return ui.adjustXP(id, delta); },
    applyLongRest()      { return ui.applyLongRest(); },
    createNPCFromTemplate(tmpl) { return ui.createNPCFromTemplate(tmpl); },
  };
}
