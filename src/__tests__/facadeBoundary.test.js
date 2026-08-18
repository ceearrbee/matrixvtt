/**
 * Facade boundary lint - no UI module may mutate `ui.state.<collection>`
 * directly via Map.set/delete/clear, or assign to a persisted singleton.
 * The StateManager (`src/state/StateManager.js`) owns those via facade
 * methods (`updateCharacter`, `updateToken`, `updateSettings`,
 * `updateInitiative`, `updateFog`, …).
 *
 * Any new hit must either route through a facade method, or be added to
 * the documented-exceptions list below with a justification.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const UI_DIR = resolve(process.cwd(), 'src/ui');

// Tracked persisted collections/singletons - mutations to these cross the
// state boundary and must go through the facade.
const PERSISTED = [
  'characters', 'npcs', 'tokens', 'items', 'spells', 'handouts',
  'tables', 'maps', 'initiative', 'settings', 'fog', 'activeMapId',
  'drawings',
];

// `.set(` / `.delete(` / `.clear(` and ` = ` assignments against these names.
const MUTATION_RE = new RegExp(
  `ui\\.state\\.(${PERSISTED.join('|')})(?:\\.(?:set|delete|clear)\\(| *= *(?!=))`,
);

// Documented exceptions - file + exact trimmed line content + reason.
// Content-anchored (not line-number-anchored) so cosmetic edits
// elsewhere in the file don't break the lint.
const EXCEPTIONS = [
  // Post-error rollback - the facade already mutated optimistically;
  // restoring the prior snapshot here is the *un-mutation* that the
  // failed write needs. Factored into _writeFog in gm/fog-ops.js.
  { file: 'src/ui/gm/fog-ops.js', content: 'ui.state.fog = prevFog;', reason: 'fog rollback on write failure' },
  // Post-tombstone local-only reset. `deleteSession` tombstones every
  // event via the network first; these three lines reset the local
  // singletons to a blank campaign without re-sending.
  { file: 'src/ui/gm/session-ops.js', content: "ui.state.settings = { gm_user_ids: [], name: '', system: 'generic', grid_px: 40 };", reason: 'post-tombstone local settings reset' },
  { file: 'src/ui/gm/session-ops.js', content: "ui.state.initiative = { active: false, round: 0, current_index: 0, order: [] };", reason: 'post-tombstone local initiative reset' },
  { file: 'src/ui/gm/session-ops.js', content: "ui.state.fog = { mode: FOG_MODES.HIDDEN, revealed: [] };", reason: 'post-tombstone local fog reset' },
  // Pre-save wizard seeding. initBlankCampaign seeds sm.settings; the
  // wizard layers user-entered performance + optional imported ruleset
  // on top locally, then saveInitialState sends the composed settings
  // to Matrix via the facade. Going through updateSettings here would
  // double-send.
  { file: 'src/ui/setup/save-flow.js', content: 'ui.state.settings = { ...ui.state.settings, performance: choice.performance };', reason: 'wizard pre-save performance seeding' },
  { file: 'src/ui/setup/save-flow.js', content: 'ui.state.settings = {', reason: 'wizard pre-save ruleset seeding (multi-line spread)' },
  // Bulk optimistic token paint before sequential facade syncs. Used
  // by healAll + clearAllConditions so the GM sees the whole effect
  // at once; the facade then writes each token through updateToken
  // with rate-limit pacing. Also sm.initiative = ... for the same
  // reason in healAll.
  { file: 'src/ui/gm/bulk-ops.js', content: 'ui.state.tokens.set(id, token);', reason: 'bulk-ops optimistic pre-paint' },
  { file: 'src/ui/gm/bulk-ops.js', content: 'if (healedInitiative) ui.state.initiative = healedInitiative;', reason: 'bulk-ops optimistic initiative paint' },
  // Post-tombstone delete-session settings reset (kept from before).
  // Signals are refreshed via notifyUpdate(VTT_EVENTS.FULL) right
  // after these four lines - the clear is local-only because the
  // Matrix-side tombstones already went out.
];

function isException(hit) {
  return EXCEPTIONS.some((ex) => hit.file === ex.file && hit.line === ex.content);
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walk(full);
    else if (/\.(js|jsx)$/.test(entry)) yield full;
  }
}

function findMutations() {
  const hits = [];
  for (const file of walk(UI_DIR)) {
    const rel = 'src/ui/' + relative(UI_DIR, file);
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      // Skip comment lines - the pattern shows up in child-entity-crud.js's JSDoc.
      if (trimmed.startsWith('*') || trimmed.startsWith('//')) return;
      if (MUTATION_RE.test(line)) {
        hits.push({ file: rel, loc: `${rel}:${i + 1}`, line: trimmed });
      }
    });
  }
  return hits;
}

describe('facade boundary - UI code does not mutate persisted state directly', () => {
  it('every `ui.state.<coll>.(set|delete|clear)` / singleton = is whitelisted or goes through a facade method', () => {
    const hits = findMutations();
    const unexpected = hits.filter((h) => !isException(h));
    if (unexpected.length) {
      const msg = unexpected
        .map((h) => `  ${h.loc}  ${h.line}`)
        .join('\n');
      throw new Error(
        `Direct state mutation(s) found in src/ui/ - route through the StateManager facade:\n${msg}`,
      );
    }
    expect(unexpected).toHaveLength(0);
  });
});
