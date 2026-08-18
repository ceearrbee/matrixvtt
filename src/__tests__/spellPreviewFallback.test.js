/**
 * Spell preview must fall back to `spell_card.sections` (and then to
 * the empty array) when a ruleset hasn't authored an explicit
 * `spell_preview` block. Pre-fix, the spell branch returned `[]`
 * without trying `spell_card` first, so 7 of 8 shipped rulesets
 * showed an empty modal when a player clicked a spell.
 *
 * The other entity preview branches (character, npc, item) already
 * have the fallback chain - this brings spell into line.
 */
import { describe, it, expect } from 'vitest';
import { _previewSectionsForTest } from '../ui/preview/preview-modals.js';

function uiWith(systemConfig) {
  return { state: { settings: { systemConfig } } };
}

describe('preview sections - spell fallback', () => {
  it('uses spell_preview.sections when defined', () => {
    const sections = [{ kind: 'description' }];
    const cfg = { spell_preview: { sections } };
    expect(_previewSectionsForTest(uiWith(cfg), 'spell')).toEqual(sections);
  });

  it('falls back to spell_card.sections when spell_preview is missing', () => {
    const sections = [{ kind: 'description' }, { kind: 'stat_row' }];
    const cfg = { spell_card: { sections } };
    expect(_previewSectionsForTest(uiWith(cfg), 'spell')).toEqual(sections);
  });

  it('returns an empty array when neither block is present', () => {
    expect(_previewSectionsForTest(uiWith({}), 'spell')).toEqual([]);
  });

  it('does not regress character / item / npc fallback chains', () => {
    const chSec = [{ kind: 'attributes' }];
    expect(_previewSectionsForTest(uiWith({ character_sheet: { sections: chSec } }), 'character')).toEqual(chSec);

    const itSec = [{ kind: 'description' }];
    expect(_previewSectionsForTest(uiWith({ item_card: { sections: itSec } }), 'item')).toEqual(itSec);

    expect(_previewSectionsForTest(uiWith({ character_sheet: { sections: chSec } }), 'npc')).toEqual(chSec);
  });
});
