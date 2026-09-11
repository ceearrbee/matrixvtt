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

const CHROME_EMOJI = ['🎬', '📖', '👤', '📦', '🗺', '🎲', '🌫', '🌤', '👥', '💢', '🛡', '💀', '🏃', '📌', '🎙', '👢', '🚫', '💬', '⚔', '＋', '⚙', '⭐', '★', '▶', '●', '↻', '☰', '▤', '📋', '🎭'];

/**
 * Files → the emoji each may keep, and why it is content rather than
 * chrome. A new entry needs a reason that survives being read aloud.
 */
const ALLOWED = {
  // Activity-log glyphs: they label a line of transcript, not a control.
  'chat/announcements.js': ['🗺', '🎲', '⚔'],
  'chat/dice-command.js': ['🎲'],
  'standalone/app-log.js': ['📋'],
  'ui/attack-modal.js': ['⚔'],
  'ui/character-sheet-sections/lists.js': ['⚔'],
  'ui/chat-log-format.js': ['🎬'],
  'ui/combat/opposed-roll.js': ['⚔'],
  'ui/dice-helpers.js': ['⚔'],
  'ui/lifecycle-init.js': ['🎬', '💬'],
  'ui/log-grouping.js': ['🗺', '🎲', '💬', '⚔'],
  'ui/log-panel.js': ['💬'],
  'ui/preview/preview-modals.js': ['🛡'],
  'ui/scene-mode.js': ['🎬'],
  'ui/state-effects.js': ['⚔'],
  'ui/state-updater.js': ['🎲'],
  'ui/tables/TableFormModal.jsx': ['🎲'],
  'ui/tables/rollTable.js': ['🎲'],
  'ui/BrowsePanel.jsx': ['🎲'],
  'ui/DiceBar.jsx': ['🎬'],
  // The log filter chips mirror the glyph of the entries they filter,
  // which is the whole recognition cue.
  'ui/LogControls.jsx': ['🗺', '🎲', '💬', '⚔'],
  // Reaction palette and picker data: user-chosen content.
  'ui/EmojiPicker.jsx': ['🎲'],
  'ui/LogPanel.jsx': ['💬'],
  'ui/ThreadView.jsx': ['🎲', '⚔'],
  'utils/wikilinks.js': ['🗺', '🎲'],
  'ui/chat-send.js': ['💬'],
  // Empty-state and section glyphs, warm by design.
  'ui/index-sections.js': ['🎬', '📖', '👤', '📦'],
  'ui/PartyRoster.jsx': ['🎭'],
  'ui/spells-ruleset.js': ['📖'],
  'ui/InitiativeEntry.jsx': ['💀'],
  // Paired state markers whose filled/hollow contrast carries the
  // meaning; an SVG pair is a separate piece of work.
  'ui/Spells.jsx': ['★'],
  'ui/Settings.jsx': ['★'],
  'ui/EntityList.jsx': ['★'],
  'ui/CombatTab.jsx': ['●'],
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
      return CHROME_EMOJI
        .filter((e) => !allowed.includes(e) && src.includes(e))
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
