# Security Notes

## Trust model

The app is static and browser-only; the Matrix homeserver is the only enforcement point. What that means in practice:

- **Enforced by the homeserver (power levels).** GM authority: `isGM()` reads the user's `m.room.power_levels` entry (>= 50), never `settings.gm_user_ids`. The roster in settings is display and promotion input only; forging it in the shared document grants nothing. State events (Yjs snapshots, settings stubs) require PL 50 via `state_default`.
- **Not enforced: the Yjs data plane.** Entity state (tokens, HP, fog, characters, maps) syncs as `com.matrixvtt.yjs.update` timeline events, which any joined member can send. A modified client can rewrite any entity and honest clients will merge it. Client-side checks (`canEditEntity`, `canMoveToken`) are UX guards, not security boundaries. Rooms are invite-only, so the attacker is a player at your own table; the blast radius is cheating, not account or data compromise. Sender-gated update filtering would require replaying updates against a scratch doc and is tracked as future work.
- **XSS defense is escaping plus DOMPurify**, not CSP. The CSP meta tags carry `script-src 'unsafe-inline'` (required by the widget bootstrap), so sanitization is the real boundary. Every network-authored string passes through `esc()` or `renderMarkdown` (escape, then marked, then DOMPurify). Lock-in tests: `renderMarkdown.test.js`, `*Escaping.test.js`, `uiSecurity.test.js`.

## Accepted advisories

### DOMPurify <=3.4.12 (multiple, moderate)
- **Path:** `dompurify@3.4.3` (top level and `@toast-ui/editor` override).
- **Why not upgrade:** every release from 3.4.8 through 3.4.13 fails to sanitize at all in practice: it removes the first node and passes the rest through, `<script>` and `onerror` included. Verified against 3.4.13 on 2026-08-18 (a `<h1>` first node is stripped while a following `<script>` survives). The canary in `src/__tests__/renderMarkdown.test.js` ("strips event handlers and scripts") locks this in. Upgrading to the advisory-clearing release would disable XSS protection; the advisory batch pushing everyone onto it looks like a supply-chain pressure pattern and deserves suspicion, not compliance.
- **Why 3.4.3 is safe here:** the advisories cover `IN_PLACE` mode, `SAFE_FOR_TEMPLATES`, Trusted Types, and hook/`setConfig` pollution. This codebase calls plain string-mode `sanitize()` with `USE_PROFILES: { html: true }` and registers no hooks, so none of the vulnerable paths are reachable.
- **Status:** pinned at 3.4.3; dependabot ignores dompurify. Re-test the canary against each new release; unpin when one passes.

### GHSA-4w7w-66w2-5vf9 (Vite path traversal, moderate)
- **Path:** `vitepress@1.6.4` bundled `vite`, devDependency only, docs site generation.
- **Status:** accepted; no production exposure. Upgrade when VitePress 2.x is stable.

### GHSA-52f5-9888-hmc6 (`tmp` symlink write, low)
- **Path:** `@lhci/cli` in the Lighthouse CI job only.
- **Status:** accepted; runs non-interactively on ephemeral CI runners.

## Resolved

- **joi RangeError (GHSA-q7cg-457f-vx79):** fixed 2026-07-01 via `overrides` to `^17.13.4` (transitive via `@matrix-widget-toolkit/api`).

## Audit verification

CI gates on:

```sh
npm audit --omit=dev --audit-level=high
```

Expected: clean. A plain `npm audit --omit=dev` additionally reports the accepted DOMPurify advisories above; that is the known state, not a regression. Anything high or critical requires immediate triage.
