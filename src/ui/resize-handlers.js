/**
 * resize-handlers.js - drag-to-resize for the initiative and sheet
 * side panels. Panel widths live on CSS custom properties on :root.
 */

export function setupResizeHandlers(_ui) {
  const root = document.documentElement;
  let drag = null;

  document.addEventListener('mousedown', (e) => {
    const handle = e.target.closest?.('[data-resize]');
    if (!handle) return;
    e.preventDefault();
    const side = handle.dataset.resize; // 'init' or 'sheet'
    const varName = side === 'init' ? '--init-panel-width' : '--sheet-panel-width';
    const startWidth = parseInt(getComputedStyle(root).getPropertyValue(varName)) || 0;
    handle.classList.add('resize-handle--dragging');
    drag = { side, varName, startX: e.clientX, startWidth, handle };
  });

  document.addEventListener('mousemove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    // init: dragging right = wider; sheet: dragging right = narrower
    const newWidth = drag.side === 'init'
      ? Math.max(120, Math.min(500, drag.startWidth + dx))
      : Math.max(180, Math.min(600, drag.startWidth - dx));
    root.style.setProperty(drag.varName, newWidth + 'px');
  });

  document.addEventListener('mouseup', () => {
    if (drag) {
      drag.handle.classList.remove('resize-handle--dragging');
      drag = null;
    }
  });
}
