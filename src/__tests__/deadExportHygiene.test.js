/**
 * knip.json ignored four live files to silence unused *exports* inside
 * them. The ignores hid the exports rather than the files, so nothing
 * would have reported the next one. These pin each module's surface to
 * what production and the tests actually import, and pin the ignore
 * list to the two files that are genuinely entry-point-less.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as tools from '../map/input/tools.js';
import * as firstTimeSetup from '../ui/first-time-setup.js';
import * as handoutsPanel from '../ui/handouts-panel.js';
import * as mapForm from '../ui/MapForm.jsx';
import * as loadedMap from './helpers/loadedMap.js';
import * as diceControls from '../ui/composer/dice-controls.jsx';
import * as globalMenuItems from '../ui/global-menu-items.js';
import * as icons from '../ui/icons/index.jsx';
import * as paletteCommands from '../ui/palette-commands.js';

const read = (rel) => readFileSync(resolve(import.meta.dirname, '../../', rel), 'utf8');

describe('map/input/tools.js', () => {
  it('re-exports only the stroke helpers callers import from it', () => {
    expect(Object.keys(tools).sort()).toEqual([
      'buildStroke',
      'buildTemplate',
      'buildWall',
      'consumePendingPlacement',
      'placeLightAt',
      'placePinAt',
      'setupTools',
      'strokeCancel',
      'strokeIsActive',
    ]);
  });
});

describe('map/input/strokes.js', () => {
  it('keeps no accessor that only existed to be re-exported', async () => {
    const strokes = await import('../map/input/strokes.js');
    expect(strokes).not.toHaveProperty('strokeStart');
    expect(strokes).not.toHaveProperty('strokeCurrent');
    expect(strokes).not.toHaveProperty('strokePencilPoints');
  });
});

describe('ui/first-time-setup.js', () => {
  it('re-exports only the setup helpers other modules import from it', () => {
    expect(firstTimeSetup).not.toHaveProperty('verifyInitialSave');
    expect(firstTimeSetup).not.toHaveProperty('countInitialSaveSteps');
    expect(firstTimeSetup).toHaveProperty('saveInitialState');
    expect(firstTimeSetup).toHaveProperty('tombstoneOldEntities');
    expect(firstTimeSetup).toHaveProperty('tombstoneStaleEvents');
  });
});

describe('ui/handouts-panel.js', () => {
  it('has no write-only "seen" store behind a badge that was never built', () => {
    expect(handoutsPanel).not.toHaveProperty('isHandoutNew');
    expect(handoutsPanel).not.toHaveProperty('markHandoutSeen');
    const src = read('src/ui/handouts-panel.js');
    expect(src).not.toMatch(/handouts-seen/);
    expect(src).not.toMatch(/revealed_at/);
    expect(read('src/ui/FloatingDoc.jsx')).not.toMatch(/markHandoutSeen/);
  });
});

describe('ui/MapForm.jsx', () => {
  it('exports only the panel MapsPanel mounts', () => {
    expect(Object.keys(mapForm)).toEqual(['MapFormPanel']);
  });
});

describe('knip.json', () => {
  it('no longer hides unused exports inside four live files', () => {
    const config = JSON.parse(read('knip.json'));
    expect(config.ignore).toEqual(['src/utils/no-op.js', 'src/ui/_public-surface.js']);
  });
});

/**
 * The eleven exports knip reported were, bar one, private data that
 * carried a stray `export`. A declaration used only inside its own file
 * is not a module surface, and leaving the keyword on makes the
 * dead-code gate red for something that is not dead.
 */
describe('declarations that only ever had one caller, in their own file', () => {
  it('the loaded-map helper exposes the function, not the fixture', () => {
    expect(Object.keys(loadedMap)).toEqual(['loadTestMap']);
  });

  it('the composer dice module exposes components, not its data', () => {
    expect(Object.keys(diceControls).sort()).toEqual([
      'ChatModePills',
      'DiceButtons',
      'ExtraRolls',
      'ModifierRow',
    ]);
  });

  it('the global menu exposes its builder, not its group names', () => {
    expect(Object.keys(globalMenuItems)).toEqual(['buildGlobalMenuItems']);
  });

  it('the palette exposes its builder, not its group names', () => {
    expect(Object.keys(paletteCommands)).toEqual(['buildPaletteCommands']);
  });

  it('the four glyphs only CONCEPT_ICONS names stay behind it', () => {
    for (const glyph of ['PeopleIcon', 'MonsterIcon', 'SpellIcon', 'SkillIcon']) {
      expect(icons, glyph).not.toHaveProperty(glyph);
    }
    expect(Object.keys(icons.CONCEPT_ICONS).sort()).toEqual([
      'character',
      'journal',
      'npc',
      'party',
      'prep',
      'skill',
      'spell',
    ]);
  });
});
