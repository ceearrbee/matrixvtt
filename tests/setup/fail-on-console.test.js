/**
 * Self-test for the channel-aware console gate.
 *
 * Each spec here verifies one branch of the gate contract. Because
 * the gate runs in afterEach (and throws to fail the test), we
 * cannot directly assert "the gate fired" - instead each spec
 * exercises an input that should be ignored, so the spec passes
 * cleanly. The companion failure-path coverage lives in
 * tests/setup/__fixtures__/ if/when we ever need to assert the
 * thrown shape.
 */
import { describe, it, expect } from 'vitest';

describe('console gate - channel-aware allow list', () => {
  it('ignores logger.error-style channel output: `[Channel] message`', () => {
    console.error('[MatrixClient] sync failed');
    console.error('[ErrorNotification] [state_write] Failed to save');
    expect(true).toBe(true);
  });

  it('ignores logger.warn-style channel output', () => {
    console.warn('[Yjs] state drift recovered');
    expect(true).toBe(true);
  });

  it('ignores Konva warnings', () => {
    console.warn('Konva warning: stage has too many layers');
    expect(true).toBe(true);
  });

  it('expectConsoleError whitelists a specific message for this test', () => {
    expectConsoleError(/explicitly allowed/);
    console.error('this message is explicitly allowed for this spec');
    expect(true).toBe(true);
  });

  it('expectConsoleWarning works the same way', () => {
    expectConsoleWarning('exact substring');
    console.warn('something exact substring something');
    expect(true).toBe(true);
  });
});
