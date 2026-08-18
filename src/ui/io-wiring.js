/**
 * io-wiring.js - attaches import / export methods to the UI controller,
 * split out of ui-methods.js.
 *
 * Every method here is a thin adapter. Logic lives in:
 *   - `./import-export.js` - full-campaign archive, markdown, ruleset I/O
 *   - `./markdown-parsers.js` - per-section character / NPC markdown parse
 *   - `../utils/uvttImport.js` - UVTT wall import (loaded lazily to keep
 *     the parser out of the initial bundle)
 *
 * The legacy `importUvttFile` body lived inline in ui-methods.js as one
 * of the last non-delegation handlers. It stays inline here so the
 * dynamic import + toast plumbing is co-located with the other I/O.
 */

import {
  showImportMarkdownDialog as showImportMarkdownDialogFn,
  exportCharactersMarkdown as exportCharactersMarkdownFn,
  exportNPCsMarkdown as exportNPCsMarkdownFn,
  characterToMarkdown as characterToMarkdownFn,
  npcToMarkdown as npcToMarkdownFn,
  exportRuleset as exportRulesetFn,
  importRuleset as importRulesetFn,
  importMarkdown as importMarkdownFn,
  importCampaign as importCampaignFn,
  syncCampaignToMatrix,
} from './import-export.js';
import { runWithProgress } from './progress-modal.js';
// `exportState` lives under gm-ops because it's the GM-initiated bulk
// serialisation action, not a pure import-export helper.
import { exportState as exportStateFn } from './gm-ops.js';
import {
  importCharacterFromMarkdown as importCharacterFromMarkdownFn,
  importNPCFromMarkdown as importNPCFromMarkdownFn,
} from './markdown-parsers.js';

export function attachIOMethods(ui) {
  // Full-campaign + markdown export
  ui.exportState = () => exportStateFn(ui);
  ui.importCampaign = async (file) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      importCampaignFn(ui.state, data);

      // syncCampaignToMatrix yields (step, label) callbacks; wrap once so
      // runWithProgress sees the (done, detail) shape it expects.
      await runWithProgress([{
        title: 'Importing Campaign',
        total: 0, // updated dynamically; runWithProgress accepts setTotal()
        run: async (onUpdate, _setTotal) => {
          let step = 0;
          await syncCampaignToMatrix(ui.state, (_, label) => {
            step += 1;
            onUpdate(step, label);
          });
        },
      }]);
      // Capture the imported state as a Yjs snapshot so reloads see it
      // synchronously from /state instead of waiting for /sync to trickle
      // in the timeline updates.
      const { publishYjsSnapshot } = await import('../state/yjs-snapshot-publish.js');
      await publishYjsSnapshot(ui.state);
      ui.render();
      ui._toast?.('Campaign imported successfully', 'success');
    } catch (err) {
      ui._toast?.(`Campaign import failed: ${err.message}`, 'error');
    }
  };
  ui.exportCharactersMarkdown = () => exportCharactersMarkdownFn(ui);
  ui.exportNPCsMarkdown = () => exportNPCsMarkdownFn(ui);
  ui.characterToMarkdown = (character, id) => characterToMarkdownFn(ui, character, id);
  ui.npcToMarkdown = (npc, id) => npcToMarkdownFn(ui, npc, id);

  // Ruleset I/O
  ui.exportRuleset = () => exportRulesetFn(ui);
  ui.importRuleset = (file) => importRulesetFn(ui, file);

  ui.showImportMarkdownDialog = () => showImportMarkdownDialogFn(ui);
  ui.importMarkdown = (content) => importMarkdownFn(ui, content);
  ui.importCharacterFromMarkdown = (section) => importCharacterFromMarkdownFn(ui, section);
  ui.importNPCFromMarkdown = (section) => importNPCFromMarkdownFn(ui, section);

  // UVTT wall import - non-delegating because the parser is loaded
  // lazily and the success/failure path touches toasts + state.addWall
  // directly. Wrapped here rather than in import-export.js so callers
  // can see the full flow in one file.
  ui.importUvttFile = async (file) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const { parseUVTT } = await import('../utils/uvttImport.js');
      const { walls, lights = [] } = parseUVTT(json);
      if (walls.length === 0 && lights.length === 0) {
        ui._toast?.('UVTT file contained no walls or lights', 'info');
        return;
      }
      const suffix = () => Math.random().toString(36).slice(2, 8);
      for (const w of walls) {
        await ui.state.addWall?.({ ...w, id: `${w.id}-${suffix()}` });
      }
      for (const l of lights) {
        await ui.state.addLight?.({ ...l, id: `${l.id}-${suffix()}` });
      }
      const parts = [];
      if (walls.length) parts.push(`${walls.length} wall segment${walls.length === 1 ? '' : 's'}`);
      if (lights.length) parts.push(`${lights.length} light${lights.length === 1 ? '' : 's'}`);
      ui._toast?.(`Imported ${parts.join(' and ')} from UVTT`, 'success');
    } catch (err) {
      ui._toast?.(`UVTT import failed: ${err.message}`, 'error');
    }
  };
}
