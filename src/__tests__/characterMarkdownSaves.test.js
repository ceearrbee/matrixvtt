/**
 * Saving_throws round-trip through characterToMarkdown →
 * importCharacterFromMarkdown.
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
      { key: 'con', label: 'CON', default: 10 },
      { key: 'int', label: 'INT', default: 10 },
      { key: 'wis', label: 'WIS', default: 10 },
      { key: 'cha', label: 'CHA', default: 10 },
    ],
    state: withFacade({
      characters: new Map(),
      sendStateEvent: vi.fn(async () => {}),
    }),
  };
}

describe('saving_throws markdown round-trip', () => {
  it('exporter emits a Saving Throws section when present', () => {
    const ui = makeUi();
    const char = {
      name: 'Aria', class_level: 'Fighter 3', species: 'Human',
      hp_current: 20, hp_max: 20, ac: 16, speed: 30, initiative_bonus: 2,
      attributes: { str: 14, dex: 12, con: 13, int: 10, wis: 10, cha: 8 },
      skills: {},
      saving_throws: { str: 5, con: 4 },
    };
    const md = characterToMarkdown(ui, char, 'chr-1');
    expect(md).toContain('### Saving Throws');
    expect(md).toMatch(/\*\*str:\*\* \+5/);
    expect(md).toMatch(/\*\*con:\*\* \+4/);
  });

  it('parser reads Saving Throws back', async () => {
    const ui = makeUi();
    const md = `## Aria\n\n**Fighter 3** · **Human**\n\n### Stats\n\n- **HP:** 20/20\n- **AC:** 16\n- **Speed:** 30\n- **Initiative:** +2\n\n### Attributes\n\n| STR | DEX | CON | INT | WIS | CHA |\n| --- | --- | --- | --- | --- | --- |\n| 14 | 12 | 13 | 10 | 10 | 8 |\n\n### Saving Throws\n\n- **str:** +5\n- **con:** +4\n`;
    await importCharacterFromMarkdown(ui, md);
    const char = Array.from(ui.state.characters.values())[0];
    expect(char.saving_throws).toEqual({ str: 5, con: 4 });
  });

  it('omitted saves section yields empty object', async () => {
    const ui = makeUi();
    const md = `## Aria\n\n**Fighter 3** · **Human**\n\n### Stats\n\n- **HP:** 20/20\n- **AC:** 16\n- **Speed:** 30\n- **Initiative:** +2\n\n### Attributes\n\n| STR | DEX | CON | INT | WIS | CHA |\n| --- | --- | --- | --- | --- | --- |\n| 14 | 12 | 13 | 10 | 10 | 8 |\n`;
    await importCharacterFromMarkdown(ui, md);
    const char = Array.from(ui.state.characters.values())[0];
    expect(char.saving_throws).toEqual({});
  });
});
