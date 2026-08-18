/**
 * MapCanvas.jsx - Preact wrapper for the Konva MapRenderer.
 * Ensures strict lifecycle management of the canvas stage and
 * implements frame-based batching for reactive updates.
 */

import { h } from 'preact';
import { useRef, useEffect } from 'preact/hooks';
import { MapRenderer } from '../map-renderer.js';

export function MapCanvas({ ui }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Initialize MapRenderer
    // Preact preserves the container across re-renders, so we only
    const renderer = /** @type {any} */ (new MapRenderer(containerRef.current, ui.state));
    renderer._ui = ui;
    ui.mapRenderer = renderer;
    ui.state.mapRenderer = renderer;

    renderer.render();

    return () => {
      renderer.destroy();
      ui.mapRenderer = null;
    };
  }, [ui]);

  return h('div', {
    ref: containerRef,
    id: 'map-canvas',
    class: 'map-canvas',
    role: 'application',
    tabindex: 0,
    'aria-label': 'Interactive game map',
    'aria-describedby': 'map-canvas-desc',
  });
}
