/**
 * Static scan: "warm content, austere chrome" (src/ui/icons/index.jsx
 * docblock). Chrome - buttons, navigation, control glyphs - renders
 * editorial SVG line icons, never emoji. Content surfaces (chat
 * bodies, condition pills, scene banners in-thread, empty-state
 * glyphs, the defeated marker) intentionally keep their emoji.
 *
 * The scan is repo-wide. It used to name fourteen chrome files, which
 * meant a file nobody had thought to add was unguarded: the map
 * right-click menus carried seventeen emoji labels for a year without
 * tripping it. Now every source file is scanned and the exceptions are
 * enumerated, each with the reason its emoji is content.
 *
 * Comments are stripped before scanning, so prose about a glyph does
 * not need an exemption.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Any emoji, not a list of the ones somebody thought of. The scan was
// already widened once - from fourteen named files to the whole tree -
// after the map context menus carried seventeen emoji for a year. The
// emoji list had the same shape and the same hole: "🧙 Wizard" sat on
// the empty roster because nobody had added 🧙. `Extended_Pictographic`
// is Unicode's own answer to "is this an emoji", so the only way past
// this gate is an exemption with a reason.
const EMOJI = /\p{Extended_Pictographic}/gu;

/**
 * Files → the emoji each may keep, and why it is content rather than
 * chrome. A new entry needs a reason that survives being read aloud.
 */
const ALLOWED = {
  // Activity-log glyphs: they label a line of transcript, not a control.
  'chat/dice-command.js': ['🎲'],
  'ui/character-sheet-sections/lists.js': ['⚔'],
  'ui/chat-log-format.js': ['🎬'],
  'ui/combat/opposed-roll.js': ['⚔'],
  'ui/dice-helpers.js': ['⚔'],
  'ui/scene-mode.js': ['🎬'],
  'ui/state-effects.js': ['⚔'],
  'ui/tables/TableFormModal.jsx': ['🎲'],
  'ui/tables/rollTable.js': ['🎲'],
  'ui/BrowsePanel.jsx': ['🎲'],
  'ui/composer/ChatCluster.jsx': ['🎬'],
  // The log filter chips mirror the glyph of the entries they filter,
  // which is the whole recognition cue.
  'ui/LogControls.jsx': ['🗺', '🎲', '💬', '⚔'],
  // Reaction palette and picker data: user-chosen content.
  'utils/wikilinks.js': ['🗺', '🎲'],
  // Empty-state and section glyphs, warm by design.
  'ui/index-sections.js': ['🎬', '📖', '👤', '📦'],
  'ui/PartyRoster.jsx': ['🎭'],
  'ui/spells-ruleset.js': ['📖'],
  'ui/InitiativeEntry.jsx': ['💀'],
  // Paired state markers whose filled/hollow contrast carries the
  // meaning; an SVG pair is a separate piece of work.
  'ui/Spells.jsx': ['★', '😴'],
  'ui/Settings.jsx': ['★'],
  'ui/EntityList.jsx': ['★'],
  'ui/CombatTab.jsx': ['●'],
  // Damage and healing in the transcript, beside the 🎲 and ⚔ rolls
  // they follow.
  'ui/log-grouping.js': ['🗺', '🎲', '💬', '⚔', '💔', '💚'],
  'ui/state-updater.js': ['🎲', '💔', '💚'],
  'chat/announcements.js': ['🗺', '🎲', '⚔', '💔', '💚'],
  // Attack outcomes, written into the log line that reports them.
  'ui/attack-modal.js': ['⚔', '💥', '🎯', '💨', '❌'],
  // Speaking mode marks the line it was said in, not the control that
  // set it - the composer's Say / Describe / OOC pills are words.
  'ui/chat-send.js': ['💬', '🔒', '💭', '📢'],
  'ui/lifecycle-init.js': ['🎬', '💬', '🔒', '💭', '📢'],
  // Reaction palettes: the emoji IS the reaction being sent.
  'ui/LogPanel.jsx': ['💬', '👍', '👎', '❤', '😂'],
  'ui/ThreadView.jsx': ['🎲', '⚔', '👍', '👎', '❤', '😂', '💔', '💚'],
  'ui/EmojiPicker.jsx': ['🎲', '🙂', '🌿', '🍕', '✈', '📚', '❤', '🏁'],
  // Status glyphs inside a message or a log line, never on a control.
  'map/actions/combat.js': ['⚠'],
  'ui/setup-persistence.js': ['⚠'],
  'ui/sheet-missing-sections.jsx': ['⚠'],
  'widget/standalone-stub.js': ['⚠'],
  'ui/NotificationLog.jsx': ['ℹ', '⚠'],
  'ui/log-panel.js': ['💬', 'ℹ'],
  'standalone/room-inspector.js': ['🔧', '✅', '⚠', 'ℹ'],
  'standalone/discovery/render.js': ['🟢'],
  'standalone/app-log.js': ['📋', '🔄', '💤', '🚪', '👁', '💥'],
  // Content-kind glyphs on previews and empty rows.
  'ui/preview/preview-modals.js': ['🛡', '🪄', '🧪'],
  'ui/spell-preview-sections.js': ['🪄'],
  'ui/entity/placement.js': ['👹'],
  'ui/gm/entity-ops.js': ['😴'],
  'ui/tables/loot-actions.js': ['🎁'],
  // "has artwork" vs "blank grid", in the row's meta line.
  'ui/MapsList.jsx': ['🖼', '🏁'],
};

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}

function sourceFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry !== '__tests__') sourceFiles(p, acc);
    } else if (/\.(js|jsx)$/.test(entry)) {
      acc.push(p);
    }
  }
  return acc;
}

describe('chrome renders SVG icons, not emoji', () => {
  const files = sourceFiles(srcRoot);

  it('scans the whole tree, not an opt-in list of files', () => {
    expect(files.length).toBeGreaterThan(300);
  });

  it('no source file carries a chrome emoji it is not exempted for', () => {
    const offenders = files.flatMap((path) => {
      const rel = relative(srcRoot, path);
      const src = stripComments(readFileSync(path, 'utf8'));
      const allowed = ALLOWED[rel] ?? [];
      return [...new Set(src.match(EMOJI) ?? [])]
        .filter((e) => !allowed.includes(e))
        .map((e) => `${rel} ${e}`);
    });
    expect(offenders).toEqual([]);
  });

  it('every exemption is still earning its place', () => {
    const stale = Object.entries(ALLOWED).flatMap(([rel, emoji]) => {
      const src = stripComments(readFileSync(resolve(srcRoot, rel), 'utf8'));
      return emoji.filter((e) => !src.includes(e)).map((e) => `${rel} ${e}`);
    });
    expect(stale).toEqual([]);
  });
});
