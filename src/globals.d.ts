/**
 * Global type extensions for MatrixVTT.
 *
 * These let tsc understand the properties the app attaches to `window` at
 * runtime (e.g. `window.ui`, `window.matrixVTT`) without requiring a full
 * TypeScript migration.  Add new globals here as they are introduced.
 */

/** Build-time constant replaced by Vite/Vitest `define` - package.json version. */
declare const __APP_VERSION__: string;

interface Window {
  /** Playwright e2e injection seam - set by tests/e2e/fixtures via
      page.addInitScript before app-client.js evaluates. Undefined in
      production. See tests/e2e/fixtures/fake-matrix-client.js. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __VTT_E2E_MATRIX_CLIENT_CLASS?: any;

  /** Main UI instance - assigned in app.js / app-client.js */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ui: any;

  /** Top-level VTT object (widget mode) - instance of MatrixVTT class in app.js */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  matrixVTT: any;

  /** Top-level VTT object (standalone client mode) - instance of MatrixVTTClient in app-client.js */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  matrixVTTClient: any;

  /** Dev helper: hot-reset the application without a full page reload */
  __vttReset: () => void;

  /** Test/widget hook: when truthy, app.js skips its auto-bootstrap so a test
      harness can construct MatrixVTT manually with stubbed deps. */
  __MVTT_DISABLE_AUTO_INIT__?: boolean;
}

/*
 * This is a JavaScript project checked with TypeScript. Most DOM handlers
 * narrow targets at runtime through selectors or Preact-controlled inputs,
 * but checkJs only sees EventTarget/Element. These optional members capture
 * the browser APIs this code intentionally uses without forcing a full TS
 * migration across every event callback.
 */
interface EventTarget {
  value?: string;
  checked?: boolean;
  files?: FileList | null;
  dataset?: DOMStringMap;
  style?: CSSStyleDeclaration;
  closest?: Element['closest'];
  focus?: HTMLElement['focus'];
  blur?: HTMLElement['blur'];
  click?: HTMLElement['click'];
}

interface Event {
  key?: string;
}

interface Element {
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  files?: FileList | null;
  dataset?: DOMStringMap;
  style?: CSSStyleDeclaration;
  focus?: HTMLElement['focus'];
  blur?: HTMLElement['blur'];
  click?: HTMLElement['click'];
  /** ModalFactory.create stashes the full-cleanup close handler here so
      callers can trigger the same teardown the X button uses. */
  _vttClose?: () => void;
}

interface KonvaNodeWithFindOne {
  findOne?: (selector: string | ((node: any) => boolean)) => any;
}
