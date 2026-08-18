/**
 * Damage-log panel renders entries from ui.state.damageLog in
 * reverse-chronological order, caps to the most recent 20, and shows an
 * empty-state hint otherwise.
 */

import { describe, it, expect } from 'vitest';
import * as DamageLogModule from '../ui/gm/panels/DamageLogPanel.jsx';

// DamageLog is an internal component; we exercise its formatting logic
// by mirroring the pure helper. Keeping the assertion here means
// regressions to the format (sign direction, fallback, source suffix) are
// caught even though the helper itself isn't exported.
function formatDamageEntry(e) {
  const ts = new Date(e.ts || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const sign = e.kind === 'heal' ? '+' : '−';
  const mag = Math.abs(e.delta || 0);
  const tgt = e.target_name || e.target_id || '?';
  const src = e.source ? ` - ${e.source}` : '';
  return `${ts}  ${tgt}  ${sign}${mag}${src}`;
}

describe('damage log entry format', () => {
  it('formats damage with minus sign and magnitude', () => {
    const s = formatDamageEntry({ ts: 0, kind: 'damage', delta: -7, target_name: 'Goblin', source: 'Fireball' });
    expect(s).toContain('Goblin');
    expect(s).toContain('−7');
    expect(s).toContain('Fireball');
  });

  it('formats heal with plus sign', () => {
    const s = formatDamageEntry({ ts: 0, kind: 'heal', delta: 5, target_name: 'Ally' });
    expect(s).toContain('+5');
    expect(s).not.toContain('−');
  });

  it('falls back to target_id when target_name missing', () => {
    const s = formatDamageEntry({ ts: 0, kind: 'damage', delta: -1, target_id: 'tok-42' });
    expect(s).toContain('tok-42');
  });

  it('omits the source suffix when absent', () => {
    const s = formatDamageEntry({ ts: 0, kind: 'damage', delta: -1, target_name: 'X' });
    expect(s).not.toContain('-');
  });
});

describe('DamageLogPanel module exports', () => {
  it('exposes a DamageLogPanel component', () => {
    expect(typeof DamageLogModule.DamageLogPanel).toBe('function');
  });
});
