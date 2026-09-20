/**
 * Upload a file and remember it in the room's asset library, so the
 * same image can be reused later instead of uploaded again.
 *
 * The upload is the thing the user asked for; the library entry is a
 * convenience on top. A failure to record is logged and swallowed, so
 * it can never cost someone their upload.
 */

import { logger } from '../../utils/logger.js';

/**
 * `name` is passed explicitly rather than read off the blob: the caller
 * has usually resized first, and a resized Blob has no filename.
 *
 * @param {object} ui
 * @param {File|Blob} blob - what actually gets uploaded
 * @param {string} kind - one of ASSET_KINDS
 * @param {{name?: string, width?: number, height?: number}} [about]
 * @returns {Promise<string|null>} the mxc:// url, or null if none came back
 */
export async function uploadAndRecord(ui, blob, kind, about = {}) {
  const mxc = await ui.widgetManager.uploadMedia(blob);
  if (!mxc) return null;
  await record(ui, mxc, kind, about);
  return mxc;
}

async function record(ui, mxc, kind, about) {
  if (typeof ui.state?.recordAsset !== 'function') return;
  try {
    await ui.state.recordAsset({
      mxc,
      kind,
      name: about.name ?? '',
      width: about.width,
      height: about.height,
    });
  } catch (err) {
    logger.warn('assets', 'Could not record the upload in the room library:', err);
  }
}
