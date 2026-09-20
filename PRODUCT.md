# MatrixVTT Product Context

Strategic design context for UI work. The visual system lives in DESIGN.md;
this file covers who the product serves and how it should feel.

## Register

Product. Design serves the task of running a live tabletop game; it never
performs at the expense of play. Clarity during a session beats spectacle.

## Users

- **Game masters** prepping and running live sessions in the browser: loading
  maps, placing tokens, revealing fog, tracking initiative, sharing handouts.
- **Players** joining by invite: chat, dice, their character sheet, and the map.
- Neither group is assumed to know Matrix. Both may play from a tablet or phone.

## North star

**"The Player's Almanac."** Editorial restraint, not fantasy costume. The
interface reads like a well-set reference book a table keeps open during play:
quiet chrome, typographic hierarchy, content first.

## Brand personality

- Calm and confident during a live game; the UI never competes with the table.
- Bookish rather than dashboard-like; prose is set in serif, controls are not.
- Honest about state: live, syncing, and error states are always visible and
  never conveyed by color alone.

## Anti-references

- Fantasy-costume UI: parchment textures, dragon kitsch, medieval fonts.
- Dense MMO-style HUDs where every feature has a permanent button.
- Generic SaaS dashboard chrome (metric cards, gradient accents).

## Design principles

1. **Type:** Work Sans for chrome and headlines, Source Serif 4 for prose,
   Bodoni Moda for display only. Serif is prose-only; controls are always
   Work Sans.
2. **Color:** dark-default, four-theme token system (Dark / Light / High
   Contrast / Nondescript) from one `--color-*` contract. One rationed blue
   accent (Table Blue) for live/selected/focused/primary only; green/amber/red
   for status, never by color alone.
3. **Surfaces:** flat by default, 0.5px hairline borders, sharp 2-3px radii;
   `box-shadow` only for genuinely floating layers.
4. **Accessibility:** WCAG 2.1 AA across all four themes; honor
   `prefers-reduced-motion`; keep the 2px focus ring.
5. **Density is mode-gated:** show what the current role and moment need;
   GM power tools are disclosed on intent, not fanned out permanently.
