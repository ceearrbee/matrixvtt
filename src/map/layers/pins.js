/**
 * src/map/layers/pins.js - Konva pins layer.
 *
 * Persistent named annotations placed by the GM via the right-click
 * context menu. Each pin renders as a tinted teardrop with a label
 * underneath; non-GMs don't see pins flagged `gm_only: true`.
 *
 * Layer is `listening: false` for now - interaction (right-click to
 * edit/remove) goes through the stage-level contextmenu handler in
 * `src/map/input/tools.js` via a hit-test on `mr.state.pins`.
 */

import { effect } from '@preact/signals';
import Konva from 'konva';
import { pinsSignal, activeMapIdSignal } from '../../state/signals.js';

const DEFAULT_COLOR = '#e6c84a';

export function createPinsLayer(stage, mr) {
  const layer = new Konva.Layer({ listening: false });
  stage.add(layer);

  const groups = new Map();
  // Cache the JSON signature of each pin's last-rendered shape; skip
  // the destroyChildren + child rebuild in update() when nothing has
  // changed. mr.render() fires on every pan / zoom tick - without
  // the cache, every pin's children were reallocated each frame.
  const lastSig = new Map();

  function isGM() { return !!mr.state?.isGM?.(); }

  function build() {
    return new Konva.Group({ listening: false });
  }

  function update(group, pin) {
    group.destroyChildren();
    const cellPx = mr.state?.map?.cell_px ?? 40;
    const cx = (pin.col + 0.5) * cellPx;
    const cy = (pin.row + 0.5) * cellPx;
    const color = pin.color || DEFAULT_COLOR;
    const zoom = mr.zoom || 1;
    const r = 8 / zoom;

    // Filled circle marker.
    group.add(new Konva.Circle({
      name: 'marker',
      x: cx, y: cy, radius: r,
      fill: color, stroke: '#000', strokeWidth: 1 / zoom,
      listening: false,
    }));
    // Inner dot for visual punch.
    group.add(new Konva.Circle({
      x: cx, y: cy, radius: r * 0.35,
      fill: '#000', listening: false,
    }));
    // Label. Provisional position below the marker; the combined map-label
    // pass (placeMapLabels, driven from the tokens layer) repositions it
    // above the marker and stacks it clear of token labels. `ellipsis` +
    // `wrap:'none'` truncate an over-long pin name instead of wrapping it.
    if (pin.label) {
      group.add(new Konva.Text({
        name: 'label',
        x: cx - 60, y: cy + r + 2 / zoom,
        width: 120, align: 'center', wrap: 'none', ellipsis: true,
        text: pin.label, fill: mr._colors?.textInverse || '#ffffff',
        fontSize: 12 / zoom, fontFamily: 'sans-serif',
        stroke: '#000', strokeWidth: 2 / zoom,
        fillAfterStrokeEnabled: true,
        listening: false,
      }));
    }
  }

  function visibleEntries() {
    const all = pinsSignal.value;
    if (!all) return [];
    const gm = isGM();
    const activeId = activeMapIdSignal.value;
    return [...all].filter(([, p]) => p && (gm || !p.gm_only) && p.map_id === activeId);
  }

  function sync() {
    const visible = visibleEntries();
    const keep = new Set();
    const cellPx = mr.state?.map?.cell_px ?? 40;
    const zoom = mr.zoom || 1;
    for (const [id, pin] of visible) {
      keep.add(id);
      const sig = `${cellPx}|${zoom}|${JSON.stringify(pin)}`;
      let group = groups.get(id);
      if (!group) {
        group = build();
        groups.set(id, group);
        layer.add(group);
        update(group, pin);
        lastSig.set(id, sig);
      } else if (lastSig.get(id) !== sig) {
        update(group, pin);
        lastSig.set(id, sig);
      }
    }
    for (const [id, group] of groups) {
      if (!keep.has(id)) {
        group.destroy();
        groups.delete(id);
        lastSig.delete(id);
      }
    }
    layer.batchDraw();
  }

  const dispose = effect(() => {
    pinsSignal.value;
    activeMapIdSignal.value;
    sync();
  });

  return { layer, groups, dispose, sync };
}
