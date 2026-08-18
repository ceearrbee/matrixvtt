# Characters (`.md`)

A **characters markdown file** is a collection of player-character sheets in a specific markdown dialect. **Settings → Export Markdown** produces files that round-trip cleanly through **Setup Wizard → Import Characters**.

The parser lives at `src/ui/markdown-parsers.js` (`importCharacterFromMarkdown`).

## File layout

```markdown
# Characters

## {Character Name}

**{Class + Level}** · **{Species}**

### Stats

- **HP:** {current}/{max}
- **AC:** {ac}
- **Speed:** {speed}
- **Initiative:** +{bonus}

### Attributes

| STR | DEX | CON | INT | WIS | CHA |
|-----|-----|-----|-----|-----|-----|
| 14  | 16  | 12  | 10  | 13  |  8  |

### Skills

- **Perception:** +5
- **Stealth:** +7

### Notes

Freeform text. May span multiple paragraphs.

---

## {Another Character}
...
```

## Rules

| Element | Requirement |
|---------|-------------|
| Root header | `# Characters` - signals the file type to the importer. |
| Per-character delimiter | One character per block, separated by a horizontal rule (`---`). |
| Character name | `## Name` - required. Missing headers skip the block silently. |
| Metadata line | `**{class_level}** · **{species}**` - both required (empty strings allowed). |
| Stats section | `### Stats` with bolded labels (`**HP:**`, `**AC:**`, `**Speed:**`, `**Initiative:**`). Missing values fall back to sensible defaults (HP 30/30, AC 10, Speed 30, Initiative +0). |
| Attributes table | `### Attributes` with a pipe table. Column headers must match the current ruleset's attribute labels (case-insensitive). Unknown columns are ignored; missing columns use the ruleset default. |
| Skills | `### Skills` with bulleted `- **Skill Name:** +N` entries. Names are lowercased and underscore-joined before storage. |
| Notes | `### Notes` - everything until the next `###` or `---`. |

## Minimal valid example

```markdown
# Characters

## Mira Quickfoot

**Rogue 3** · **Halfling**

### Stats

- **HP:** 22/22
- **AC:** 15
- **Speed:** 25
- **Initiative:** +3

### Attributes

| STR | DEX | CON | INT | WIS | CHA |
|-----|-----|-----|-----|-----|-----|
|  8  | 17  | 12  | 11  | 13  | 14  |

### Skills

- **Stealth:** +7
- **Sleight of Hand:** +7

### Notes

Prefers rooftops.
```

## Round-trip

The easiest way to produce a valid file is to export an existing campaign's characters via **Settings → Export → Characters (markdown)** and edit from there.
