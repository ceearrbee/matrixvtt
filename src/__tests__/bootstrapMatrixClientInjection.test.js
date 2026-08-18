/**
 * The `StandaloneApp` constructor exposes `matrixClientClass` as a DI
 * seam (`src/standalone/bootstrap.js`). Playwright e2e specs use it to
 * swap in a fake matrix client so the VTT shell can render against
 * deterministic in-memory state without a real homeserver.
 *
 * A redundant `this.MatrixClient = MatrixClient` re-assignment used
 * to shadow the constructor argument so the seam never actually
 * worked. This regression lock catches that class of bug.
 */
import { describe, it, expect } from 'vitest';
import { StandaloneApp } from '../standalone/bootstrap.js';

class FakeMatrixClient {
  static fake = true;
  static async discoverHomeserver(hs) { return hs; }
}

describe('StandaloneApp - matrixClientClass injection', () => {
  it('uses the injected class when provided', () => {
    const app = new StandaloneApp({ matrixClientClass: FakeMatrixClient });
    expect(app.MatrixClient).toBe(FakeMatrixClient);
    expect(app.MatrixClient.fake).toBe(true);
  });

  it('falls back to the imported default when nothing is injected', () => {
    const app = new StandaloneApp({});
    expect(app.MatrixClient).toBeDefined();
    expect(app.MatrixClient.fake).toBeUndefined();
  });
});
