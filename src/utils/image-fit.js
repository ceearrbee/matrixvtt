/**
 * Auto-fit cell-size helper for the maps form. Reads the chosen
 * image's natural dimensions, divides by the user-entered cell count,
 * and writes the result into `#map-cell-px`. Replaces a
 * trial-and-error loop: upload → guess
 * px → save → look → adjust → repeat.
 */

export async function autoFitCellSize(button, ui) {
  const form = button.closest('form');
  if (!form) return;
  const widthCells = parseInt(form.querySelector('#map-width')?.value, 10) || 0;
  if (widthCells <= 0) {
    ui._toast?.('Enter a Width (cells) value first.', 'info');
    return;
  }
  const file = form.querySelector('#map-upload')?.files?.[0];
  const url = (form.querySelector('#map-url')?.value || '').trim();
  const src = file ? URL.createObjectURL(file) : (url || null);
  if (!src) {
    ui._toast?.('Choose a map image (file or URL) first.', 'info');
    return;
  }
  try {
    const dims = await readImageDims(src);
    const cellPx = Math.round(dims.width / widthCells);
    if (!Number.isFinite(cellPx) || cellPx < 1) {
      ui._toast?.('Image too small for that many columns.', 'error');
      return;
    }
    const cellInput = form.querySelector('#map-cell-px');
    if (cellInput) {
      cellInput.value = String(cellPx);
      cellInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    ui._toast?.(`Cell size set to ${cellPx} px (${dims.width} ÷ ${widthCells}).`, 'success');
  } catch (err) {
    ui._toast?.(`Couldn't read image: ${err.message}`, 'error');
  } finally {
    if (file && src.startsWith('blob:')) URL.revokeObjectURL(src);
  }
}

function readImageDims(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('failed to decode'));
    img.src = src;
  });
}
