/**
 * Lock-in: the modal token-create path and the panel/API
 * `createToken` path must agree on the default aura color.
 *
 * Background - before this fix, `TokenFormModal.jsx` had its own
 * `AURA_DEFAULT_COLOR = '#5BB8E8'` while `tokens-panel.js` used
 * `TOKEN_COLORS.AURA_DEFAULT = '#4a9eff'`. A token created via the
 * modal got a visibly different aura color than one created
 * programmatically. The fix routes both through `TOKEN_COLORS`.
 *
 * This test reads the bundle source to assert the modal no longer
 * declares a local aura-default constant. Behavior-level coverage of
 * the panel path lives in tokens-panel tests.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { TOKEN_COLORS } from '../utils/ui-constants.js';

describe('Token aura default - parity between entry paths', () => {
  it('TOKEN_COLORS.AURA_DEFAULT is the canonical value', () => {
    // Pin the canonical color so an accidental edit to ui-constants
    // surfaces here, not in the visual diff.
    expect(TOKEN_COLORS.AURA_DEFAULT).toBe('#4a9eff');
  });

  it('TokenFormModal.jsx does not define a local aura-default constant', () => {
    const path = resolve(import.meta.dirname, '../ui/TokenFormModal.jsx');
    const src = readFileSync(path, 'utf8');
    // Any local AURA_DEFAULT_COLOR / AURA_COLOR_DEFAULT / similar private
    // const would let the two entry paths drift again.
    expect(src).not.toMatch(/const\s+AURA_[A-Z_]*DEFAULT[A-Z_]*\s*=/);
  });

  it('TokenFormModal.jsx references TOKEN_COLORS.AURA_DEFAULT', () => {
    const path = resolve(import.meta.dirname, '../ui/TokenFormModal.jsx');
    const src = readFileSync(path, 'utf8');
    expect(src).toMatch(/TOKEN_COLORS\.AURA_DEFAULT/);
  });
});
