# Campaign Archive (`.json`)

A **campaign archive** is a full, self-contained snapshot of a MatrixVTT session: settings, maps, every entity collection, fog, initiative, and drawings. It's what **Settings → Export JSON** produces, and what **Setup Wizard → Import full campaign archive** consumes.

When a campaign archive is uploaded in the blank-campaign wizard, it takes precedence over every other option on the form - it fully replaces the blank defaults, so per-type imports (ruleset, characters, NPCs) on the same form are ignored.

## Top-level shape

```json
{
  "version": 1,
  "exported_at": 1718630400000,
  "settings": { ... },
  "maps":       [ { "id": "...", ... } ],
  "tokens":     [ { "id": "...", ... } ],
  "characters": [ { "id": "...", ... } ],
  "npcs":       [ { "id": "...", ... } ],
  "items":      [ { "id": "...", ... } ],
  "spells":     [ { "id": "...", ... } ],
  "handouts":   [ { "id": "...", ... } ],
  "tables":     [ { "id": "...", ... } ],
  "pins":       [ { "id": "...", ... } ],
  "fog":        { "mode": "hidden", "revealed": [] },
  "initiative": { "active": false, "round": 0, "current_index": 0, "order": [] },
  "drawings":   [],
  "activeMapId": "..."
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `version` | yes | Current `CAMPAIGN_FORMAT_VERSION = 1`. |
| `exported_at` | yes | Unix ms timestamp; informational. |
| `settings` | yes | Merged into session settings on import. See [Ruleset](/formats/ruleset) for the shape of `settings.systemConfig`. |
| `maps[]`, `tokens[]`, `characters[]`, `npcs[]`, `items[]`, `spells[]`, `handouts[]`, `tables[]`, `pins[]` | arrays | Each entry must have a stable `id`. See [Data Model Spec](/DATA-MODEL-SPEC) for entity fields. |
| `fog` | yes | `{ mode: 'hidden' \| 'revealed', revealed: [[col,row], ...] }`. |
| `initiative` | yes | Combat tracker state. |
| `drawings[]` | yes | Array of stroke objects. |
| `activeMapId` | yes | Must match an `id` in `maps[]`. |

### Blank-campaign example

Auto-generated from `initBlankCampaign` in `src/state/campaign-init.js` → `exportCampaign`. Regenerated on every docs build:

<<< @/examples/blank-campaign.json

## Round-trip

To produce a reference archive, run an existing session through **Settings → Export JSON** and inspect the output. The exporter lives at `src/ui/import-export.js` (`exportCampaign`); the importer is `importCampaign` in the same file. The examples above are generated directly from that exporter, so they're always in sync with the code.
