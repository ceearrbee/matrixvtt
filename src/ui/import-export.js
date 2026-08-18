/**
 * import-export.js - barrel over the split IO modules.
 *
 * The actual implementations live in format-specific files so each
 * module handles one export format end-to-end:
 *   - markdown-io.js   → character / NPC markdown export + import
 *   - ruleset-io.js    → `.vttruleset.json` export + import
 *   - state/campaign-sync.js → full-campaign JSON export, local reseed, bulk sync
 *
 * This barrel exists because existing call sites already import from
 * `./import-export.js`; new code should import from the specific module.
 */

export {
  exportCharactersMarkdown,
  exportNPCsMarkdown,
  characterToMarkdown,
  npcToMarkdown,
  downloadMarkdown,
  showImportMarkdownDialog,
  importMarkdown,
} from './markdown-io.js';

export { exportRuleset, importRuleset } from './ruleset-io.js';

export {
  exportCampaign,
  importCampaign,
  syncCampaignToMatrix,
} from '../state/campaign-sync.js';
