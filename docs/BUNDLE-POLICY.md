# Bundle Policy

Accepted payload costs for artifacts in `dist/`, measured against the
real build. Update the snapshot whenever the eager set changes shape.

## Build Snapshot (v1.1.0 + tour split, 2026-08-18)

### Eager set (`app.html` entry script + modulepreload)

Everything the standalone shell needs through login and the live table
loads up front: `matrix-sdk` (~1.15 MB raw), `chat-integrator`
(~746 KB), `matrix-widget` (~349 KB), `konva` (~185 KB), plus the app
entry and small vendor chunks (preact, dnd-kit, marked, sonner, fuse,
dompurify, focus-trap, valibot, rxjs, tinykeys, idb-keyval).

**Eager total: ~2.75 MB raw, ~654 KB brotli over the wire.**

This is deliberate, not drift. Commit `acb15c0` converted the VTT
runtime from dynamic to static imports because mobile Firefox discards
dynamic-import capability when it evicts a background tab: a logged-in
player returning to the table got a dead shell that could not load the
runtime it needed. One preload burst at first visit, service-worker
cached afterwards, beats a mid-session brick.

### Lazy set (loaded on demand)

| Chunk | Raw size | Load condition |
|---|---|---|
| `matrix_sdk_crypto_wasm_bg-*.wasm` | ~5.6 MB | E2EE activation only (encrypted room). |
| `esm-*.js` (toast-ui editor) | ~553 KB | Opening a page in Visual edit mode. |
| `monsters-*.js` / `spells-*.js` / `items-*.js` | ~1.2 MB combined | Opening the compendium browser. |
| `MapsPanel-*.js`, `uvttImport-*.js`, `yjs-snapshot-publish-*.js` | small | Feature entry points. |
| `tour-runtime-*.js` + `driver-*.js/.css` | ~26 KB | Starting the onboarding tour. The mobile-Firefox resume rationale below does not apply: the tour is user-triggered post-login UI, and a failed import degrades to a toast, not a dead shell. |

## Policy decisions

1. **Accept the eager floor (~654 KB brotli).** Resilience on mobile
   outweighs first-paint size; the login screen itself paints from an
   inline style island before any chunk arrives.
2. **Keep crypto conditional.** The 5.6 MB wasm loads only when an
   encrypted session actually starts.
3. **Gate with size-limit.** `package.json#size-limit` measures brotli:
   app 50 kB, matrix-widget 100 kB, chat-integrator 190 kB, konva
   60 kB, matrix-sdk 270 kB, toast-ui esm 160 kB. Raising a limit is a
   reviewed decision, never a side effect.

## Revision triggers

- Upstream `matrix-js-sdk` slimming (tree-shakeable crypto store).
- A reduced wasm build upstream.
- Mobile Firefox fixing dynamic import after tab resume (would allow
  re-splitting the VTT runtime).

## Verification

```sh
npm run build
npm run size
grep -c modulepreload dist/app.html
ls -lS dist/assets/*.js | grep -v '\.map'
```

The wasm binary, the toast-ui/compendium chunks, and the driver/tour
chunks must NOT appear in `app.html`'s modulepreload list
(`tests/smoke/static-build.test.js` gates the driver part).
