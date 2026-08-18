/**
 * Token overlay dispatcher. Rulesets declare an `overlays[]` list on
 * `systemConfig.token`; each entry is `{kind, ...config}`. Mounted below
 * the token (resource bars) or in corners (badges, pips).
 *
 * This module stays Canvas2D-ctx based so it can be called from the
 * Konva sceneFunc of a per-token shape (Konva exposes the underlying
 * CanvasRenderingContext2D via `context._context`). Keeping the pure
 * drawer here means the same logic serves both the Konva layer and the
 * existing unit tests.
 *
 * Unknown kinds silently skip (forward compat - ruleset may be authored
 * against a newer engine).
 */

import { HP_COLORS } from '../utils/ui-constants.js';

function drawResourceBar(ctx, token, config, x, y, radius) {
  const cur = Number(token?.[config.current_field] ?? 0);
  const max = Number(token?.[config.max_field] ?? 0);
  if (!Number.isFinite(max) || max <= 0) return;
  const pct = Math.max(0, Math.min(1, cur / max));

  const thresholds = config.thresholds ?? [
    { min: 0.5, color: HP_COLORS.GOOD },
    { min: 0.25, color: HP_COLORS.WARN },
    { min: 0, color: HP_COLORS.DANGER },
  ];
  let color = thresholds[thresholds.length - 1].color;
  for (const t of thresholds) if (pct >= t.min) { color = t.color; break; }

  const slot = config._slot ?? 0;
  const barY = y + radius + 4 + slot * 6;

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x - radius, barY, radius * 2, 4);
  ctx.fillStyle = color;
  ctx.fillRect(x - radius, barY, radius * 2 * pct, 4);
}

function drawPipTrack(ctx, token, config, x, y, radius) {
  const field = config.field;
  const boxes = token?.[field];
  if (!Array.isArray(boxes)) return;
  const count = config.count ?? boxes.length;
  const pipR = Math.max(2, 4 / (config._zoom ?? 1));
  const gap = pipR * 2 + 2;
  const totalWidth = count * gap;
  const startX = x - totalWidth / 2 + pipR;
  const pipY = y + radius + 6;

  for (let i = 0; i < count; i++) {
    ctx.beginPath();
    ctx.arc(startX + i * gap, pipY, pipR, 0, Math.PI * 2);
    ctx.fillStyle = boxes[i] ? (config.filled_color ?? HP_COLORS.DANGER) : (config.empty_color ?? 'rgba(0,0,0,0.3)');
    ctx.fill();
  }
}

function drawBadge(ctx, token, config, x, y, radius) {
  const value = token?.[config.field];
  if (!value) return;
  const text = `${config.prefix ?? ''}${value}`;
  const br = 6;
  const bx = x + radius - br;
  const by = y - radius + br;

  ctx.fillStyle = config.bg_color ?? 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.arc(bx, by, br, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = config.color ?? '#fff';
  ctx.font = `${br}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx, by);
}

const KINDS = {
  resource_bar: drawResourceBar,
  pip_track:    drawPipTrack,
  badge:        drawBadge,
};

export function renderTokenOverlays(ctx, token, overlays, x, y, radius) {
  if (!Array.isArray(overlays) || overlays.length === 0) return;

  let barSlot = 0;
  for (const overlay of overlays) {
    const fn = KINDS[overlay?.kind];
    if (!fn) continue;
    const cfg = overlay.kind === 'resource_bar' ? { ...overlay, _slot: barSlot++ } : overlay;
    fn(ctx, token, cfg, x, y, radius);
  }
}
