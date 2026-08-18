/**
 * Spell_slots round-trip through character markdown.
 * Shape: { "1": { total: 4, used: 1 }, "2": { total: 2, used: 0 } }
 */

import { describe, it, expect, vi } from 'vitest';
import { characterToMarkdown } from '../ui/import-export.js';
import { importCharacterFromMarkdown } from '../ui/markdown-parsers.js';
import { withFacade } from './helpers/withFacade.js';

function makeUi() {
  return {
    widgetManager: { userId: '@p:s' },
    _getSystemAttrs: () => [
      { key: 'str', label: 'STR', default: 10 },
      { key: 'dex', label: 'DEX', default: 10 },
    ],
    state: withFacade({
      characters: new Map(),
      sendStateEvent: vi.fn(async () => {}),
    }),
  };
}

const baseChar = {
  name: 'Mage', class_level: 'Wizard 3', species: 'Elf',
  hp_current: 18, hp_max: 18, ac: 12, speed: 30, initiative_bonus: 1,
  attributes: { str: 8, dex: 14 }, skills: {},
};

describe('spell_slots markdown round-trip', () => {
  it('exporter emits Spell Slots section', () => {
    const ui = makeUi();
    const md = characterToMarkdown(ui, {
      ...baseChar,
      spell_slots: { '1': { total: 4, used: 1 }, '2': { total: 2, used: 0 } },
    }, 'chr-1');
    expect(md).toContain('### Spell Slots');
    expect(md).toMatch(/Level 1:\*\*\s*1\/4/);
    expect(md).toMatch(/Level 2:\*\*\s*0\/2/);
  });

  it('parser reads Spell Slots back', async () => {
    const ui = makeUi();
    const md = `## Mage\n\n**Wizard 3** · **Elf**\n\n### Stats\n\n- **HP:** 18/18\n- **AC:** 12\n- **Speed:** 30\n- **Initiative:** +1\n\n### Attributes\n\n| STR | DEX |\n| --- | --- |\n| 8 | 14 |\n\n### Spell Slots\n\n- **Level 1:** 1/4\n- **Level 2:** 0/2\n`;
    await importCharacterFromMarkdown(ui, md);
    const char = Array.from(ui.state.characters.values())[0];
    expect(char.spell_slots).toEqual({
      '1': { total: 4, used: 1 },
      '2': { total: 2, used: 0 },
    });
  });

  it('omitted section yields empty spell_slots object', async () => {
    const ui = makeUi();
    const md = `## Mage\n\n**Wizard 3** · **Elf**\n\n### Stats\n\n- **HP:** 18/18\n- **AC:** 12\n- **Speed:** 30\n- **Initiative:** +1\n\n### Attributes\n\n| STR | DEX |\n| --- | --- |\n| 8 | 14 |\n`;
    await importCharacterFromMarkdown(ui, md);
    const char = Array.from(ui.state.characters.values())[0];
    expect(char.spell_slots).toEqual({});
  });
});
