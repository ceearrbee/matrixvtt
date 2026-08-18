/**
 * F4: token overlays driven by ruleset.token.overlays[].
 * Each overlay is {kind, ...config}. Kinds: resource_bar, pip_track, badge.
 * Dispatcher iterates the list and invokes kind-specific draw functions
 * against a canvas 2D context.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderTokenOverlays } from '../map/token-overlays-draw.js';

function mockCtx() {
  const calls = [];
  return {
    calls,
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    fillRect: (...args) => calls.push(['fillRect', ...args]),
    fillText: (...args) => calls.push(['fillText', ...args]),
    beginPath: () => calls.push(['beginPath']),
    arc: (...args) => calls.push(['arc', ...args]),
    fill: () => calls.push(['fill']),
    set fillStyle(v) { calls.push(['fillStyle=', v]); },
    set font(v) { calls.push(['font=', v]); },
    set textAlign(v) { calls.push(['textAlign=', v]); },
    set textBaseline(v) { calls.push(['textBaseline=', v]); },
  };
}

describe('renderTokenOverlays', () => {
  it('empty or missing overlays → no-op', () => {
    const ctx = mockCtx();
    renderTokenOverlays(ctx, { hp_current: 10, hp_max: 10 }, [], 50, 50, 20);
    renderTokenOverlays(ctx, {}, undefined, 0, 0, 10);
    expect(ctx.calls.length).toBe(0);
  });

  it('unknown kind silently skips', () => {
    const ctx = mockCtx();
    renderTokenOverlays(ctx, { hp_current: 5, hp_max: 10 }, [{ kind: 'martian_ray' }], 0, 0, 10);
    expect(ctx.calls.length).toBe(0);
  });
});

describe('resource_bar', () => {
  it('draws background + foreground bars proportional to current/max', () => {
    const ctx = mockCtx();
    const overlays = [{ kind: 'resource_bar', current_field: 'hp_current', max_field: 'hp_max' }];
    renderTokenOverlays(ctx, { hp_current: 5, hp_max: 10 }, overlays, 100, 100, 20);
    const fillRects = ctx.calls.filter((c) => c[0] === 'fillRect');
    expect(fillRects.length).toBe(2);
    // Background spans the full diameter (40px); foreground is 50% of that
    expect(fillRects[0][3]).toBe(40); // width
    expect(fillRects[1][3]).toBe(20); // 50% of 40
  });

  it('skipped when max is zero or missing', () => {
    const ctx = mockCtx();
    const overlays = [{ kind: 'resource_bar', current_field: 'hp_current', max_field: 'hp_max' }];
    renderTokenOverlays(ctx, { hp_current: 5 }, overlays, 0, 0, 10);
    expect(ctx.calls.length).toBe(0);
  });

  it('thresholds switch colour by percentage', () => {
    const ctx = mockCtx();
    const overlays = [{ kind: 'resource_bar', current_field: 'c', max_field: 'm',
      thresholds: [{ min: 0.5, color: '#0f0' }, { min: 0.25, color: '#ff0' }, { min: 0, color: '#f00' }] }];
    // 60% → green
    renderTokenOverlays(ctx, { c: 6, m: 10 }, overlays, 0, 0, 10);
    const styles = ctx.calls.filter((c) => c[0] === 'fillStyle=').map((c) => c[1]);
    expect(styles).toContain('#0f0');
  });
});

describe('pip_track', () => {
  it('draws one pip per declared box; filled when stress[i] true', () => {
    const ctx = mockCtx();
    const overlays = [{ kind: 'pip_track', field: 'stress', count: 3 }];
    renderTokenOverlays(ctx, { stress: [true, false, true] }, overlays, 0, 0, 10);
    const arcs = ctx.calls.filter((c) => c[0] === 'arc');
    expect(arcs.length).toBe(3);
  });
});

describe('badge', () => {
  it('renders a corner label when the source field is truthy', () => {
    const ctx = mockCtx();
    const overlays = [{ kind: 'badge', field: 'exhaustion_level', prefix: 'E' }];
    renderTokenOverlays(ctx, { exhaustion_level: 3 }, overlays, 0, 0, 10);
    const texts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
    expect(texts).toContain('E3');
  });

  it('skipped when field is falsy', () => {
    const ctx = mockCtx();
    const overlays = [{ kind: 'badge', field: 'exhaustion_level', prefix: 'E' }];
    renderTokenOverlays(ctx, { exhaustion_level: 0 }, overlays, 0, 0, 10);
    const texts = ctx.calls.filter((c) => c[0] === 'fillText');
    expect(texts.length).toBe(0);
  });
});
