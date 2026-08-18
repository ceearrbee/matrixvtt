# DESIGN.md - MatrixVTT visual system

The visual source of truth. `PRODUCT.md` covers who the product serves and how
it should feel; this file covers what things look like and which tokens to use.
When this file and a component disagree, the component is the bug.

North star: **"The Player's Almanac."** Quiet, bookish chrome; the tactical map
and the words on a handout are the loudest things on screen, never the toolbar.

## Themes and the token contract

Dark-default, four themes from one `--color-*` contract: Dark, Light, High
Contrast, Nondescript. Each theme is one file under `src/themes/`; `dark.css` is
the fallback for both bare `:root` and `:root[data-theme="dark"]`. Never hardcode
a hex, `rgb()`, or a literal color name (`white`, `black`) in a component; every
color must resolve through a token so all four themes and the a11y themes track.

Layout tokens (theme-independent, in `src/styles.css`):

- Type sizes: `--font-size-xs` (12px) … `--font-size-xl` (20px).
- Radii: `--border-radius-sm` (2px), `-md` (3px), `-lg` (4px). Corners are sharp.
- Spacing: `--space-2xs` (2px) … `--space-4xl` (24px). Use these for
  margin/padding/gap; never inline raw px for spacing.
- Stacking: `--z-base` … `--z-toast`. Use these, not raw `z-index` integers.

Color tokens (per theme, e.g. `src/themes/dark.css`):

- Surfaces: `--color-background-primary | -secondary | -tertiary`, plus
  `--color-background-hover` and the tinted `--color-background-{info,success,warning,danger}`.
- Ink: `--color-text-primary | -secondary | -tertiary`, `--color-text-inverse`,
  and semantic `--color-text-{info,success,warning,danger}`.
- Borders: `--color-border-primary | -secondary | -tertiary` (neutral hairlines),
  plus `--color-border-{info,success,warning,danger}`.
- Focus: `--color-focus`. Map: `--color-map-bg`, `--color-map-floor`.

### The rationed accent (Table Blue)

There is exactly one accent: Table Blue (`#5BB8E8` dark, `#1565C0` light),
exposed as the semantic trio `--color-text-info` / `--color-border-info` /
`--color-background-info` and mirrored by `--color-focus`.

Use it **only** for what is live, selected, focused, or the single primary action
in a flow. Forbidden as decoration, as a fill behind static text, or as a
gradient. Never introduce a second competing accent.

Canonical usage for a "selected / active / live" state:

- ink → `--color-text-info`
- border → `--color-border-info`
- tint fill → `--color-background-info`
- focus ring → `--color-focus`

`--color-primary` and `--color-accent` are legacy aliases of `--color-text-info`;
`--color-border` aliases `--color-border-primary`. **Prefer the specific
`*-info` / `*-primary` border tokens** in new work so selected-state styling is
uniform across sibling components. The `.dbt--active` treatment (blue ink on a
blue tint with a blue hairline) is the standard "this is on" pattern.

### Status is never color-alone

Green / amber / red (`--color-*-success | -warning | -danger`) carry status only,
and never by color alone. Pair every status hue with an icon, label, or shape so
High Contrast, Nondescript, and color-blind players lose nothing.

## Typography

Three families, strict roles:

- **Work Sans** (`--font-headline`) - all chrome: buttons, tabs, rows, inputs,
  panel and card headings. The default `body` font.
- **Source Serif 4** (`--font-body`) - sustained prose only (handouts, Pages,
  notes), via `.editorial-body`. Measure capped ~46-75ch. Never set controls,
  tabs, table cells, or dense labels in the serif.
- **Bodoni Moda** (`--font-display`) - display only: rare marquee titles on
  welcome / empty surfaces.

The uppercase tracked eyebrow (`.eyebrow`) is an editorial device for
welcome / empty / onboarding surfaces only. Not for routine app chrome.

## Surfaces and elevation

Flat by default. A docked surface (one that does not float above the app plane)
gets a **0.5px hairline border** and a tonal surface step, not a shadow.
`box-shadow` is reserved for genuinely floating layers: modals, dropdowns,
drawers, toasts (see the `floating-control` / `drawer-*` / `elev-*` shadow
recipes in `design.json`). Corners stay at the 2-3px radius tokens.

## Motion and accessibility

- WCAG 2.1 AA across all four themes.
- `prefers-reduced-motion: reduce` neutralizes all animation/transition; the
  override sits at the top of `styles.css` and must not be overridden.
- Keep the **2px focus ring at 2px offset** on every interactive element
  (`outline: 2px solid var(--color-focus); outline-offset: 2px`).
- Every interactive surface is keyboard-reachable: real `<button>`, or
  `role="button"` + `tabindex="0"` + an Enter/Space handler. A clickable card
  that isn't keyboard-operable is a bug.

## Component recipes

Shared building blocks (reuse before inventing):

- **Buttons:** `.dbt` base + `.dbt--sm` / `.dbt--compact` / `.dbt--active` /
  `.dbt--danger`, `.btn-primary` for the single primary action.
- **Chip:** pill filter, ≥28px tall, transparent until hover/active.
- **Modal:** `src/ui/Modal.jsx` (overlay, focus trap, scroll lock, Esc,
  dirty-guard); mount imperatively via `src/ui/modal-host.js`.
- **Empty state:** `src/ui/EmptyState.jsx` + `.empty-state`.
- **Card:** clickable-card scaffold - `role="button"`, `tabindex="0"`,
  Enter/Space opens preview, click bails on `closest('button')`, a `__header`
  flex row, and an action row whose buttons `stopPropagation`. Selected state
  uses the accent trio above.
- **Tab toolbar:** `.tab-toolbar` header (title + actions), add and
  "from-SRD" actions in the toolbar, not scattered per surface.
- **Entity browser:** master/detail search + result list (search input, a
  `role="listbox"` of `role="option"` rows on a 0.5px-bordered container with
  hairline row dividers, detail pane with gated write actions).

## The rules (do / don't)

Do: ration Table Blue to live/selected/focused/primary; separate docked surfaces
with the hairline and tonal steps, not shadow; set prose in Source Serif 4 and
everything else in Work Sans; pair every status color with an icon or label; keep
the 2px focus ring; reach for `--space-*` / `--border-radius-*` / `--z-*` tokens.

Don't: rebuild a wall-of-panels HUD (use mode-gated progressive disclosure);
drift into SaaS dashboard tropes (gradient hero metrics, identical icon-card
grids); add fantasy skeuomorphism (parchment, faux leather, filigree, Ren-fair
fonts); collapse into a chat clone; use a colored border-stripe >1px as an
accent; use gradient text, glassmorphism, or a second accent; put the eyebrow on
routine chrome; shadow a docked (non-floating) surface; hardcode a hex or literal
color name where a token exists.
