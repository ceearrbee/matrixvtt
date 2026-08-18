---
layout: home
hero:
  name: MatrixVTT
  text: Matrix-native virtual tabletop
  tagline: Virtual tabletop implementing Matrix state events for real-time synchronization. No dedicated backend required.
  actions:
    - theme: brand
      text: File Formats
      link: /formats/campaign
    - theme: alt
      text: Architecture
      link: /ARCHITECTURE
    - theme: alt
      text: Application
      link: /matrixvtt/
features:
  - title: Content Import
    details: Supports import of campaigns, rulesets, characters, and NPCs.
  - title: Matrix Synchronization
    details: Tokens, fog, initiative, drawings, pings, and sheets synchronize via Matrix room state or timeline events.
  - title: Deployment
    details: Operates as a Matrix widget within compatible clients or as a standalone web application.
  - title: Native Room Entry
    details: Supports public room joins, private room knock requests, and live invite acceptance.
  - title: State Footprint Management
    details: Entity IDs reuse positional slots to prevent unbounded state event accumulation.
  - title: Bulk Write Visibility
    details: Displays live progress and rate-limit warnings for session deletion, campaign save, and campaign import.
---

## Documentation Index

- **[File Formats](/formats/campaign)**: Schemas for campaign archives, custom rulesets, character, and NPC markdown.
- **[Architecture](/ARCHITECTURE)**: Application structure and state flow.
- **[Data Model](/DATA-MODEL-SPEC)**: Entity shape reference.
- **[Matrix Integration](/MATRIX-INTEGRATION)**: Matrix state event synchronization model.
- **[Contributing](/contributing/readme)**: Development environment setup and guidelines.
