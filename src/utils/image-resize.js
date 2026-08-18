/**
 * Client-side image scale-down for the map-upload path.
 *
 * Matrix homeservers enforce a per-upload size cap (matrix.org +
 * Synapse default: 50 MB; community servers commonly 10 MB). A
 * 4000+ pixel battle-map JPEG quickly crosses the smaller caps;
 * a federation-safe target is 2048 px on the longer edge, which
 * yields ~1–3 MB JPEGs.
 *
 * `resizeImageBlob(file, maxDim, quality)`:
 *  - Returns the original file unchanged when no scaling is needed.
 *  - Otherwise decodes the image, scales the longer edge to maxDim
 *    (aspect ratio preserved), re-encodes via OffscreenCanvas in
 *    the same format as the input, returns the new Blob.
 *  - Falls back to JPEG for unknown image types.
 *  - Revokes the temporary object URL so the original file blob
 *    is GC-eligible immediately.
 */

const SUPPORTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

/**
 * @param {File|Blob} file
 * @param {number} maxDim - longer-edge cap in pixels.
 * @param {number} quality - 0..1 for JPEG/WebP encoders. Ignored for PNG.
 * @returns {Promise<Blob>}
 */
export async function resizeImageBlob(file, maxDim = 2048, quality = 0.9) {
  if (!file || !(file instanceof Blob)) {
    throw new Error('resizeImageBlob: file must be a Blob');
  }
  if (!Number.isFinite(maxDim) || maxDim <= 0) {
    throw new Error('resizeImageBlob: maxDim must be a positive number');
  }

  const url = URL.createObjectURL(file);
  let img;
  try {
    img = await _loadImage(url);
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }

  const { naturalWidth: w, naturalHeight: h } = img;
  if (Math.max(w, h) <= maxDim) {
    URL.revokeObjectURL(url);
    return file;
  }

  const scale = maxDim / Math.max(w, h);
  const tw = Math.round(w * scale);
  const th = Math.round(h * scale);

  const canvas = _makeCanvas(tw, th);
  const ctx = /** @type {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D|null} */ (canvas.getContext('2d'));
  if (!ctx) {
    URL.revokeObjectURL(url);
    throw new Error('resizeImageBlob: 2D context unavailable');
  }
  ctx.drawImage(img, 0, 0, tw, th);
  URL.revokeObjectURL(url);

  const outputType = SUPPORTED_TYPES.has(file.type) ? file.type : 'image/jpeg';
  return _toBlob(canvas, outputType, quality);
}

function _loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('resizeImageBlob: failed to decode source image'));
    img.src = url;
  });
}

function _makeCanvas(w, h) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function _toBlob(canvas, type, quality) {
  // OffscreenCanvas: convertToBlob({ type, quality }).
  // HTMLCanvasElement: toBlob(callback, type, quality).
  if (canvas.convertToBlob) {
    return canvas.convertToBlob({ type, quality }).catch((err) => {
      throw new Error(`resizeImageBlob: convertToBlob failed: ${err?.message || err}`);
    });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('resizeImageBlob: toBlob returned null'));
      },
      type,
      quality,
    );
  });
}
