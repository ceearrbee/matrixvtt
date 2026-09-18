/**
 * Every game system gets a playable sheet, not just D&D 5e.
 *
 * `play_actions` is the "what can I do on my turn" surface, and it
 * shipped in one ruleset of nine. A Fate player opened their sheet to
 * eleven expanded reference sections and nothing that said what to do.
 * Four systems' "previews" were byte-identical to their own sheets, so
 * clicking a token opened a popup cloning the panel already beside it.
 *
 * None of that needed engine work - `PlayActions` resolves four
 * ruleset-agnostic sources and hides empty groups, and the `collapsed`
 * wrapper already existed. The data was never written. This gate is
 * what stops a tenth ruleset shipping the same way.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(here, '../content/rulesets');

const rulesets = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => [f, JSON.parse(readFileSync(join(dir, f), 'utf8'))]);

const sections = (block) => (Array.isArray(block?.sections) ? block.sections : []);
const kinds = (block) => sections(block).map((s) => s?.kind);

describe('every ruleset ships a playable character sheet', () => {
  it('finds all nine built-in rulesets', () => {
    expect(rulesets.length).toBe(9);
  });

  for (const [name, data] of rulesets) {
    describe(name, () => {
      it('brings its own condition vocabulary', () => {
        const conditions = data.conditions;
        expect(Array.isArray(conditions), `${name} declares no conditions`).toBe(true);
        expect(conditions.length).toBeGreaterThan(0);
        for (const c of conditions) {
          expect(typeof c.key).toBe('string');
          expect(typeof c.label).toBe('string');
          expect(typeof c.abbr).toBe('string');
        }
      });

      it('leads with one turn surface', () => {
        const found = kinds(data.character_sheet).filter((k) => k === 'play_actions');
        expect(found, 'no play_actions section: the sheet never says what to do').toHaveLength(1);
      });

      it('collapses its reference sections by default', () => {
        const all = sections(data.character_sheet);
        const collapsed = all.filter((s) => s?.collapsed);
        expect(collapsed.length, 'every section expanded is the wall-of-panels DESIGN.md bans')
          .toBeGreaterThan(0);
        expect(collapsed.length, 'a sheet collapsed to nothing is not a sheet')
          .toBeLessThan(all.length);
      });

      // stat_grid is vitals - AC, Speed, Initiative - read every turn,
      // not reference material to be tucked away.
      it('never collapses the turn surface, the health track or the vitals', () => {
        const OPEN = ['play_actions', 'resource_track', 'stat_grid', 'wounds'];
        for (const s of sections(data.character_sheet)) {
          if (OPEN.includes(s?.kind)) {
            expect(s.collapsed, `${s.kind} must stay open`).toBeFalsy();
          }
        }
      });

      for (const kind of ['character_preview', 'npc_preview']) {
        it(`${kind} is a peek, not a clone of the sheet`, () => {
          const preview = sections(data[kind]);
          if (preview.length === 0) return;
          const sheet = sections(data.character_sheet);
          expect(preview.length, 'preview is as long as the sheet it previews')
            .toBeLessThan(sheet.length);
        });
      }
    });
  }
});
