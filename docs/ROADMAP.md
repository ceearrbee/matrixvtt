# Implementation Roadmap

This document structures the technical implementation phases and development conventions for MatrixVTT.

## Development Conventions
- **Test-Driven Operations:** Logic mutations require prior definition of failing unit tests within `src/__tests__/`.
- **Atomic Commits:** Individual commits must be restricted to isolated functional targets.
- **Code Validation:** Commit cycles require `npm test` and `npm run lint` validation states to read zero errors.
- **Modification Scale:** Code diff structures should not exceed 200 lines, exclusive of test and schema definitions.

## Deployed Architecture

### Core Operations
- Validated `UIController` abstraction and data-model implementations.
- Implemented robust `line_of_sight` ray-casting computations.
- Structured centralized damage auditing configurations.

### Extensible Ruleset Implementations
- Deprecated monolithic configuration payloads.
- Replaced system execution paths with dynamic JSON-AST parsers, generalized dice logic constructs, and table lookup mechanisms.
- Validated structures for `dnd5e`, `fate`, `gurps`, and `ose` configurations.

### Entity Modeling
- Transitioned component parameters (`CharacterSheet`, `NPCSheet`) to ruleset-driven arrays.
- Structured decoupling processes across non-player schemas.
- Converted core data definitions to exact `spec_version` strings.

### Environmental Implementations
- Implemented Universal VTT parser pathways.
- Migrated generic measurements to deterministic hex-grid arrays.
- Implemented environment tint mappings, hierarchical markdown models, and localized `m.reaction` logic mechanisms.

### Completed Tracks (audited 2026-07-16)
- **1A** wall/template persistence across `importCampaign` (`src/__tests__/exportCampaignWallsTemplates.test.js`).
- **1B** live `cost_gp` / `ac_bonus` derived fields (`src/engine/evaluate.js`).
- **1C** saves/items/actions arrays through `importCharacterFromMarkdown` (`src/ui/markdown-parsers.js`).
- **1D** centralized damage audit (`src/__tests__/damageAudit.test.js`).
- **3A** per-token vision raycasting and fog (`src/map/vision-light.js`).
- **3D** layer filtering for background and gm-only nodes (`src/utils/tokenLayer.js`).
- **4F** encounter difficulty from ruleset tables (`src/engine/encounterDifficulty.js`).
- **4H** markdown wikilinks as inter-document navigation (`src/utils/wikilinks.js`).
- **5J** UVTT wall/light import (`src/utils/uvttImport.js`).
- **5K** hex distance per `grid_type` (`src/utils/hexGrid.js`).
- **5M** weather/time environment tint (`src/utils/environmentTint.js`).
- **1E** superseded: entity state moved to Yjs CRDTs (`src/state/YjsManager.js`), whose state vectors provide the causal ordering that linear version identifiers were meant to add.
- **2.7-2.8** GM/player power-level split over legacy and Yjs event types (`src/widget/capabilities.js`).
- **3B** attack automation through the damage audit path (`resolveAttack` in `src/ui/attack-modal.js` into `applyDamage` in `src/map/actions/combat.js`).
- **4E** indexed compendium search (`src/content/compendium/search-index.js`).
- **4G** coin value and weight aggregation from ruleset currency tables (`src/engine/currency.js`).
- **5L** map transition wikilinks via `switchMap` (`src/ui/maps/wikilink.js`).

- **2.1-2.6** superseded: the L5/I2/combat-manager refactors decomposed the UI controllers along different seams than the per-view `controller.js` files this track prescribed; the no-god-files rule in CLAUDE.md carries the goal forward.

### Closed Tracks (audited 2026-09-18)
- **Track C Data Evaluators** superseded and delivered: the prescribed string tokenizer would have been a second expression language beside the JSON-AST evaluator, which `CLAUDE.md` names as the one permitted path. Derived values reach the sheet through `stat.formula` against `src/engine/evaluate.js`, and `src/__tests__/rulesetFormulaReaders.test.js` and `rulesetFormulaPaths.test.js` hold every declared formula to a reader and a resolvable context. The typed `FormulaError` of the original spec is deliberately not built; `evaluate` degrades an unknown operator or path to `null` so a composed expression renders "-" instead of throwing mid-sheet.
- **Track N Context Routing** delivered: `m.thread` relations run end to end. `src/ui/log-panel.js` reads the relation off the timeline into `threadOf`, `src/ui/log-grouping.js` nests replies under their root and promotes orphans, `src/ui/ThreadView.jsx` renders a thread for both the scenes forum and page comments, `src/ui/chat-send.js` writes the relation on send, and `src/ui/index-sections.js` routes a `scene:` channel into `src/ui/ScenesForum.jsx`.
