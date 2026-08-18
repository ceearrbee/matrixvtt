# MatrixVTT Release Checklist

This document details the procedural validation requirements for application releases. All procedures are required prior to public distribution.

## System Prerequisites
- **Runtime Configuration:** Node.js 22.x
- **Environment State:** Clean working tree required
- **Network Dependency:** Validated access to a staging Matrix homeserver

## 1. Automated Validation Checks
Execute the static validation sequence. Operations must return an exit code of 0.
```sh
npm ci
npm run check
npm run build
npm run size
npm audit --audit-level=high --omit=dev
```
Dependency advisories returned without the `--omit=dev` directive must be documented in `docs/SECURITY-NOTES.md`.

## 2. Static Build Integrity
The static build test suite (`tests/smoke/static-build.test.js`) automates verification of core path structures:
- Validates static path mappings within `dist/index.html` (widget profile).
- Validates static path mappings within `dist/app.html` (standalone profile).
- Enforces reference existence for all parsed `href` and `src` attributes.

## 3. End-to-End Evaluation Matrix
The Continuous Integration `e2e` execution flow automates Playwright evaluations across predefined application environments:
- Chromium
- Firefox
- WebKit
- Mobile (iPhone SE profile)

**Requirement:** All target profiles must complete successfully. Review Playwright artifact telemetry for any browser-specific failures.

## 4. Accessibility Conformance
Execute manual inspection of the application rendering path:
- Navigation sequences must cover all interactive control surfaces.
- Focus geometry must render visible outlines on all active nodes.
- Elements must maintain WCAG AA color contrast ratios.
- Modal systems must trap interaction states and restore sequential focus upon destruction.
- Dynamic interface states must broadcast via `role="status"`.

## 5. Flow Verification
Authenticate with the designated homeserver and validate behavior transitions:
- **Blank Campaign Sequence:** Initializing a blank campaign populates a default map and settings with no console output.
- **State Isolation:** Generating a blank campaign against existing room data requires explicit textual validation by the user.
- **Tutorial Mechanisms:** Product tours must maintain successful end-to-end traversal properties.
- **Authentication Copy:** Homeserver login documentation must communicate connection logic with clarity.

## 6. Operational Resilience
Execute fault-tolerance procedures within active room systems:
- **Rate Limit Buffering:** Trigger mass-state mutations. HTTP 429 warnings must trigger sequential queuing through `src/state/queue.js` without data truncation.
- **Connectivity Disruption:** Manually disable network connectivity. User interfaces must generate explicit "sync dead" states and auto-resolve upon connection resumption.
- **Entity Deletion:** Trigger primary structure removal logic. Progress metrics must be presented, leading to consistent final state resolution.
- **Transient Failures:** Transient write failures must log `VTTError` metrics locally to the user.

## 7. Deployment Procedures
- Validate CI `check` execution state.
- Validate CI `e2e` coverage across all four rendering engines.
- Validate CI `lighthouse` thresholds. Acceptable limit deviations must be tracked locally.
- Publish `dist/` pipeline to GitHub Pages under the `/matrixvtt/` specification path.
- Verify `health.json` structural match across the deployment process via `.github/workflows/deploy.yml`.
- Execute standalone operational verification. Applications must compile with zero browser console errors and present correct `<meta name="build-version">` string values.
- Tag git branch deployment hash and merge documentation parameters from `SECURITY-NOTES.md` and `BUNDLE-POLICY.md`.

## 8. Release Artifact Generation
Compile local validation diagnostics for incorporation into the release notes structure:
```sh
npm run check
npm run build
npm run test:smoke
npm run size
npm audit --audit-level=high --omit=dev
npm audit --audit-level=high
```
Extract metrics from associated GitHub Actions integrations:
- `e2e` target execution logs.
- `lighthouse` rendering telemetry.
- Health validation payloads defining URL artifact alignment.
