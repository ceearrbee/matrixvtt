/**
 * Character inventory round-trip through markdown.
 *
 * Items are cross-entity (Character.inventory_ids → Item.id). Export
 * embeds item stats inline so the file is self-contained; import
 * dedupes by name+damage+weight against existing items so re-importing
 * doesn't create duplicates.
 */
import { describe, it, expect, vi } from 'vitest';
import { characterToMarkdown } from '../ui/markdown-io.js';
import { importCharacterFromMarkdown } from '../ui/markdown-parsers.js';

function makeUi({ items = [] } = {}) {
  const itemsMap = new Map(items.map((i) => [i.id, i]));
  return {
    widgetManager: { userId: '@me:m' },
    state: {
      items: itemsMap,
      updateItem: vi.fn(async (id, item) => itemsMap.set(id, item)),
      updateCharacter: vi.fn(),
    },
    _getSystemAttrs: () => [
      { key: 'STR', label: 'STR', default: 10 },
      { key: 'DEX', label: 'DEX', default: 10 },
    ],
  };
}

const baseChar = {
  name: 'Aria',
  class_level: 'Fighter 3',
  species: 'Half-Elf',
  hp_current: 24, hp_max: 28, ac: 16, speed: 30, initiative_bonus: 2,
  attributes: { STR: 14, DEX: 16 },
  skills: {},
  saving_throws: {},
  spell_slots: {},
  inventory_ids: [],
  notes: '',
};

describe('characterToMarkdown - inventory section', () => {
  it('emits an Inventory section listing each item with stats', () => {
    const ui = makeUi({
      items: [
        { id: 'i1', name: 'Longsword', quantity: 1, weight: 3, damage: '1d8', damage_type: 'slashing', properties: 'versatile' },
        { id: 'i2', name: 'Healing Potion', quantity: 2, weight: 0.5, description: 'Heals 2d4+2.' },
      ],
    });
    const md = characterToMarkdown(ui, { ...baseChar, inventory_ids: ['i1', 'i2'] }, 'chr-aria');
    expect(md).toMatch(/### Inventory/);
    expect(md).toMatch(/#### Longsword/);
    expect(md).toMatch(/qty: 1/);
    expect(md).toMatch(/Damage:.*1d8 slashing/);
    expect(md).toMatch(/#### Healing Potion/);
    expect(md).toMatch(/Heals 2d4\+2\./);
  });

  it('omits the Inventory section when inventory_ids is empty', () => {
    const ui = makeUi();
    const md = characterToMarkdown(ui, baseChar, 'chr-x');
    expect(md).not.toMatch(/### Inventory/);
  });
});

describe('importCharacterFromMarkdown - inventory round-trip', () => {
  it('creates new items for each inventory block when none match', async () => {
    const ui = makeUi();
    const md = `## Aria

**Fighter 3** · **Half-Elf**

### Stats

- **HP:** 24/28
- **AC:** 16
- **Speed:** 30
- **Initiative:** +2

### Attributes

| STR | DEX |
| --- | --- |
| 14 | 16 |

### Inventory

#### Longsword

*qty: 1 · weight: 3*

- **Damage:** 1d8 slashing
- **Properties:** versatile

A finely balanced blade.
`;
    await importCharacterFromMarkdown(ui, md);
    expect(ui.state.updateItem).toHaveBeenCalledTimes(1);
    const updateChar = ui.state.updateCharacter.mock.calls[0][1];
    expect(updateChar.inventory_ids).toHaveLength(1);
  });

  it('reuses existing items when name+damage+weight match (dedupe)', async () => {
    const ui = makeUi({
      items: [
        { id: 'existing-1', name: 'Longsword', damage: '1d8', weight: 3 },
      ],
    });
    const md = `## Aria

**Fighter 3** · **Half-Elf**

### Stats

- **HP:** 24/28
- **AC:** 16
- **Speed:** 30
- **Initiative:** +2

### Attributes

| STR | DEX |
| --- | --- |
| 14 | 16 |

### Inventory

#### Longsword

*qty: 1 · weight: 3*

- **Damage:** 1d8 slashing
`;
    await importCharacterFromMarkdown(ui, md);
    expect(ui.state.updateItem).not.toHaveBeenCalled();
    const updateChar = ui.state.updateCharacter.mock.calls[0][1];
    expect(updateChar.inventory_ids).toEqual(['existing-1']);
  });
});
