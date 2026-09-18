/**
 * Uploading a map image, with the robustness the map form worked out:
 * pre-shrink, ask before retrying smaller, and fall back to an
 * external URL.
 *
 * Extracted from the map form because the UVTT import needs the same
 * three layers for the image embedded in the file.
 */

import { confirmAsync } from '../confirm-dialogs.jsx';
import { resizeImageBlob } from '../../utils/image-resize.js';

const DEFAULT_MAX_MAP_DIM = 2048;
const DEFAULT_RESIZE_QUALITY = 0.9;

/**
 * Upload a map image with three layers of robustness:
 *  1. Pre-shrink to `max_map_dim` (default 2048 px on the longer
 *     edge) so the request fits the homeserver's per-upload cap.
 *  2. If the homeserver still 413s with `M_TOO_LARGE`, ask the GM
 *     whether to retry at half the previous max-dim and re-attempt.
 *  3. On second failure, suggest the URL field as an external
 *     image-host fallback.
 *
 * Returns the resulting `mxc://` URL on success, or `null` if the
 * GM declined the retry / a fatal error was already toasted.
 */
export async function uploadMapImage(ui, file) {
  const settings = ui.state?.settings ?? {};
  const initialMax = Number(settings.max_map_dim) > 0
    ? Number(settings.max_map_dim)
    : DEFAULT_MAX_MAP_DIM;
  return _resizeAndUpload(ui, file, initialMax, /* retried */ false);
}

async function _resizeAndUpload(ui, file, maxDim, retried) {
  let resized;
  try {
    resized = await resizeImageBlob(file, maxDim, DEFAULT_RESIZE_QUALITY);
  } catch (err) {
    // Resize failure → fall back to raw upload; the user still gets
    // a chance even if the encoder choked on a weird format.
    ui._toast?.(`Couldn't resize image, uploading as-is: ${err.message}`, 'info');
    resized = file;
  }
  try {
    return await ui.widgetManager.uploadMedia(resized);
  } catch (err) {
    if (retried || !_isTooLarge(err)) throw err;
    return _retryAtSmallerCap(ui, file, maxDim);
  }
}

function _isTooLarge(err) {
  if (!err) return false;
  return err.errcode === 'M_TOO_LARGE'
      || err.status === 413
      || err.httpStatus === 413
      || /too large|413/i.test(err.message || '');
}

function _retryAtSmallerCap(ui, file, prevMax) {
  return new Promise((resolve) => {
    const next = Math.max(512, Math.round(prevMax / 2));
    confirmAsync(
      `Image still too large for this homeserver after resizing to ${prevMax} px. ` +
      `Retry at ${next} px?`,
      async () => {
        const url = await _resizeAndUpload(ui, file, next, /* retried */ true);
        resolve(url);
      },
      {
        title: 'Image too large', confirmText: `Retry @ ${next}px`, busyText: 'Retrying…',
        // If the user dismisses without retrying, the caller would otherwise
        // hang waiting on this promise - resolve null so it falls back to the
        // external-URL path.
        onCancel: () => {
          ui._toast?.(
            'Map upload cancelled. You can paste an external image URL instead - see the URL field above.',
            'info',
          );
          resolve(null);
        },
      },
    );
  });
}