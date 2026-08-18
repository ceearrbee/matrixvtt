/**
 * NPC legendary/lair/reactions/traits round-trip.
 */
import { describe, it, expect, vi } from 'vitest';
import { npcToMarkdown } from '../ui/markdown-io.js';
import { importNPCFromMarkdown } from '../ui/markdown-parsers.js';

function makeUi() {
  return {
    widgetManager: { userId: '@me:m' },
    state: {
      updateNPC: vi.fn(),
    },
    _getSystemAttrs: () => [
      { key: 'STR', label: 'STR', default: 10 },
      { key: 'DEX', label: 'DEX', default: 10 },
    ],
  };
}

describe('npcToMarkdown - extra action sections', () => {
  it('emits Legendary Actions / Lair Actions / Reactions / Traits when present', () => {
    const ui = makeUi();
    const md = npcToMarkdown(ui, {
      name: 'Ancient Red Dragon',
      cr: '24', size_category: 'Gargantuan',
      hp_current: 546, hp_max: 546, ac: 22, speed: 40,
      attributes: { STR: 30, DEX: 10 },
      actions: [{ name: 'Bite', description: 'bites' }],
      legendary_actions: [{ name: 'Tail Attack', description: 'sweeps' }],
      lair_actions: [{ name: 'Volcanic Gas', description: 'gas' }],
      reactions: [{ name: 'Wing Buffet', description: 'buffets' }],
      traits: [{ name: 'Legendary Resistance', description: 'resists' }],
    }, 'npc-1');
    expect(md).toMatch(/### Legendary Actions/);
    expect(md).toMatch(/### Lair Actions/);
    expect(md).toMatch(/### Reactions/);
    expect(md).toMatch(/### Traits/);
    expect(md).toMatch(/#### Tail Attack/);
    expect(md).toMatch(/#### Volcanic Gas/);
    expect(md).toMatch(/#### Wing Buffet/);
    expect(md).toMatch(/#### Legendary Resistance/);
  });

  it('omits empty sections', () => {
    const ui = makeUi();
    const md = npcToMarkdown(ui, {
      name: 'Goblin', cr: '1/4', size_category: 'Small',
      hp_current: 7, hp_max: 7, ac: 13, speed: 30,
      attributes: { STR: 8, DEX: 14 },
      actions: [{ name: 'Scimitar', description: 'slashes' }],
    }, 'npc-2');
    expect(md).not.toMatch(/Legendary Actions/);
    expect(md).not.toMatch(/Lair Actions/);
    expect(md).not.toMatch(/Reactions/);
    expect(md).not.toMatch(/Traits/);
  });
});

describe('importNPCFromMarkdown - extra action sections', () => {
  it('parses Legendary/Lair/Reactions/Traits into matching arrays', async () => {
    const ui = makeUi();
    const md = `## Ancient Red Dragon

**CR 24** · **Gargantuan**

### Stats

- **HP:** 546/546
- **AC:** 22
- **Speed:** 40

### Attributes

| STR | DEX |
| --- | --- |
| 30 | 10 |

### Actions

#### Bite

bites

### Legendary Actions

#### Tail Attack

sweeps

### Lair Actions

#### Volcanic Gas

gas

### Reactions

#### Wing Buffet

buffets

### Traits

#### Legendary Resistance

resists
`;
    await importNPCFromMarkdown(ui, md);
    expect(ui.state.updateNPC).toHaveBeenCalledTimes(1);
    const npc = ui.state.updateNPC.mock.calls[0][1];
    expect(npc.actions).toHaveLength(1);
    expect(npc.legendary_actions[0].name).toBe('Tail Attack');
    expect(npc.lair_actions[0].name).toBe('Volcanic Gas');
    expect(npc.reactions[0].name).toBe('Wing Buffet');
    expect(npc.traits[0].name).toBe('Legendary Resistance');
  });
});
