/**
 * Static scan: "warm content, austere chrome" (src/ui/icons/index.jsx
 * docblock). Chrome - buttons, navigation, control glyphs - renders
 * editorial SVG line icons, never emoji. Content surfaces (chat
 * bodies, condition pills, scene banners in-thread, empty-state
 * glyphs, the 💀 defeated marker) intentionally keep their emoji.
 *
 * Scans the chrome components for the migrated emoji set; each file
 * may keep only its allow-listed content emoji.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(resolve(here, '../ui', f), 'utf8');

const CHROME_EMOJI = ['🎬', '📖', '👤', '📦', '🗺', '🎲', '🌫', '🌤', '👥', '💢', '🛡', '💀', '🏃', '📌', '🎙', '👢', '🚫', '💬', '⚔', '＋', '⚙', '⭐', '★', '▶', '●', '↻', '☰', '▤', '📋', '🎭'];

/** Chrome files → content emoji each is allowed to keep. */
const FILES = {
  'IconRail.jsx': [],
  'GMTab.jsx': [],
  'MobileTabBar.jsx': [],
  'AttackModal.jsx': [],
  'CharacterSheet.jsx': [],
  'ComposerActionsPopover.jsx': [],
  'Composer.jsx': ['🎬'],            // scene banner - in-thread content
  'DiceBar.jsx': ['🎬'],             // scene banner - in-thread content
  'InitiativeEntry.jsx': ['💀'],      // defeated marker - warm content
  'Header.jsx': [],
  'popups/FloatingPopup.jsx': [],
  'mode-registry.js': [],
  'QuickTray.jsx': [],
  'MapsList.jsx': [],
  'LeftIndex.jsx': [],
};

describe('chrome renders SVG icons, not emoji', () => {
  for (const [file, allowed] of Object.entries(FILES)) {
    it(`${file} contains no chrome emoji`, () => {
      const src = read(file);
      const offenders = CHROME_EMOJI.filter(
        (e) => !allowed.includes(e) && src.includes(e),
      );
      expect(offenders, `${file} still uses: ${offenders.join(' ')}`).toEqual([]);
    });
  }
});
