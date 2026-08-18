/**
 * src/map/input/pan-zoom.js - pan + zoom + pinch on the Konva stage.
 *
 * Listeners attach to `stage.on(...)`
 * (not the underlying canvas). Wheel zooms around the cursor; mouse
 * drag with middle-button or space+left pans; one-finger touch pans;
 * two-finger touch pinch-zooms.
 */

export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 5.0;
export const ZOOM_STEP = 1.2;

function containerPoint(stage, clientX, clientY) {
  const rect = stage.container().getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

/**
 * Zoom around a stage-local pivot (mx, my). Used by the wheel handler
 * (pivot = cursor), the pinch handler (pivot = midpoint), and the
 * button-driven zoomIn / zoomOut (pivot = viewport centre). Setting
 * `mr._userFramedViewport = true` here means a subsequent resize() will
 * preserve the user's framing rather than auto-refit.
 */
export function zoomAround(mr, mx, my, factor) {
  const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, mr.zoom * factor));
  if (newZoom === mr.zoom) return;
  mr.panX = mx - (mx - mr.panX) * (newZoom / mr.zoom);
  mr.panY = my - (my - mr.panY) * (newZoom / mr.zoom);
  mr.zoom = newZoom;
  mr._userFramedViewport = true;
  mr.render();
}

export function setupPanZoom(mr) {
  const stage = mr.stage;
  if (!stage) return () => {};

  let panStart = null;
  let pinchPrevDist = 0;

  stage.on('wheel.panzoom', (e) => {
    e.evt?.preventDefault?.();
    const { x: mx, y: my } = containerPoint(stage, e.evt.clientX, e.evt.clientY);
    const factor = e.evt.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    zoomAround(mr, mx, my, factor);
  });

  stage.on('mousedown.panzoom', (e) => {
    if (e.evt.button === 1 || (e.evt.button === 0 && mr._spaceDown)) {
      e.evt.preventDefault?.();
      panStart = { x: e.evt.clientX - mr.panX, y: e.evt.clientY - mr.panY };
      mr._isPanning = true;
      const c = stage.container();
      if (c?.style) c.style.cursor = 'grabbing';
    }
  });
  stage.on('mousemove.panzoom', (e) => {
    if (!panStart) return;
    mr.panX = e.evt.clientX - panStart.x;
    mr.panY = e.evt.clientY - panStart.y;
    mr._userFramedViewport = true;
    mr.render();
  });
  stage.on('mouseup.panzoom', () => {
    if (panStart) {
      panStart = null;
      mr._isPanning = false;
      const c = stage.container();
      if (c?.style) c.style.cursor = mr._spaceDown ? 'grab' : 'default';
    }
  });

  stage.on('touchstart.panzoom', (e) => {
    const ev = e.evt;
    if (ev.touches.length === 1) {
      panStart = { x: ev.touches[0].clientX - mr.panX, y: ev.touches[0].clientY - mr.panY };
      pinchPrevDist = 0;
    } else if (ev.touches.length === 2) {
      ev.preventDefault?.();
      panStart = null;
      pinchPrevDist = Math.hypot(
        ev.touches[0].clientX - ev.touches[1].clientX,
        ev.touches[0].clientY - ev.touches[1].clientY,
      );
    }
  });
  stage.on('touchmove.panzoom', (e) => {
    const ev = e.evt;
    if (ev.touches.length >= 2) ev.preventDefault?.();
    if (ev.touches.length === 1 && panStart) {
      mr.panX = ev.touches[0].clientX - panStart.x;
      mr.panY = ev.touches[0].clientY - panStart.y;
      mr._userFramedViewport = true;
      mr.render();
    } else if (ev.touches.length === 2 && pinchPrevDist > 0) {
      const dist = Math.hypot(
        ev.touches[0].clientX - ev.touches[1].clientX,
        ev.touches[0].clientY - ev.touches[1].clientY,
      );
      const factor = dist / pinchPrevDist;
      const midX = (ev.touches[0].clientX + ev.touches[1].clientX) / 2;
      const midY = (ev.touches[0].clientY + ev.touches[1].clientY) / 2;
      const { x: mx, y: my } = containerPoint(stage, midX, midY);
      pinchPrevDist = dist;
      zoomAround(mr, mx, my, factor);
    }
  });
  stage.on('touchend.panzoom', (e) => {
    if (e.evt.touches.length === 0) { panStart = null; pinchPrevDist = 0; }
  });

  // Konva's stage.on attaches passive listeners for touch events, which
  // means our e.evt.preventDefault calls inside `wheel`/`touchmove` are
  // silently ignored - letting the browser zoom the page on two-finger
  // pinch and scroll on wheel. Attach raw listeners with passive:false
  // for the gestures we own; they run alongside Konva and only call
  // preventDefault, leaving Konva's handlers to do the math.
  const container = stage.container();
  const onWheel = (ev) => { ev.preventDefault?.(); };
  const onTouchMove = (ev) => {
    if (ev.touches && ev.touches.length >= 2) ev.preventDefault?.();
  };
  const onTouchStart = (ev) => {
    if (ev.touches && ev.touches.length >= 2) ev.preventDefault?.();
  };
  container?.addEventListener('wheel', onWheel, { passive: false });
  container?.addEventListener('touchstart', onTouchStart, { passive: false });
  container?.addEventListener('touchmove', onTouchMove, { passive: false });

  return () => {
    stage.off('.panzoom');
    container?.removeEventListener('wheel', onWheel, { passive: false });
    container?.removeEventListener('touchstart', onTouchStart, { passive: false });
    container?.removeEventListener('touchmove', onTouchMove, { passive: false });
  };
}
