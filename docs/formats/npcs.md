# NPCs (`.md`)

An **NPCs markdown file** is a collection of non-player-character stat blocks in a specific markdown dialect. **Settings → Export Markdown** produces files that round-trip through **Setup Wizard → Import NPCs**.

Parser: `src/ui/markdown-parsers.js` (`importNPCFromMarkdown`).

## File layout

```markdown
# NPCs

## {NPC Name}

**CR {challenge_rating}** · **{size_category}**

### Stats

- **HP:** {current}/{max}
- **AC:** {ac}
- **Speed:** {speed}

### Attributes

| STR | DEX | CON | INT | WIS | CHA |
|-----|-----|-----|-----|-----|-----|
| 16  | 12  | 15  |  6  | 10  |  7  |

### Actions

#### {Action Name}

*+{attack_bonus} to hit*, *{damage} {damage_type}*

{Prose description of the action.}

#### {Another Action}
...

---

## {Another NPC}
...
```

## Rules

| Element | Requirement |
|---------|-------------|
| Root header | `# NPCs` - signals the file type to the importer. |
| Per-NPC delimiter | Horizontal rule (`---`) between NPC blocks. |
| NPC name | `## Name` - required. |
| Metadata line | `**CR {value}** · **{size_category}**`. Defaults to `CR 1` / `Medium` if missing. |
| Stats section | `### Stats` with bolded `**HP:**`, `**AC:**`, `**Speed:**`. Defaults: HP 20/20, AC 10, Speed 30. |
| Attributes table | `### Attributes` + pipe table, same rules as [Characters](/formats/characters#rules). |
| Actions section | `### Actions` with `####` subsections. Each action may declare `*+N to hit*` and `*NdN <damage_type>*` inline markers the parser extracts. The first paragraph after the inline markers becomes the action description. |

## Minimal valid example

```markdown
# NPCs

## Goblin Scout

**CR 1/4** · **Small**

### Stats

- **HP:** 7/7
- **AC:** 13
- **Speed:** 30

### Attributes

| STR | DEX | CON | INT | WIS | CHA |
|-----|-----|-----|-----|-----|-----|
|  8  | 14  | 10  | 10  |  8  |  8  |

### Actions

#### Shortbow

*+4 to hit*, *1d6+2 piercing*

Ranged attack to 80/320 ft.
```

## Round-trip

Produce a reference file by exporting an existing campaign's NPCs via **Settings → Export → NPCs (markdown)**.
