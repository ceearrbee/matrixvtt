/**
 * What a DOM `<img src>` should be handed for any image URL the app
 * holds.
 *
 * Entity portraits are stored as `mxc://` URIs, which no browser can
 * fetch, and Matrix 1.11 put them behind an authenticated endpoint on
 * top of that. `src/utils/media-cache.js` does the resolving; this is
 * the render-time face of it.
 *
 * Reading `mediaVersionSignal` here is load-bearing: it subscribes
 * whichever component called us, so the portrait appears by itself once
 * the blob lands instead of needing every caller to hold state.
 */

import { mediaVersionSignal } from '../state/ui-signals.js';
import { resolveMedia } from './media-cache.js';

/**
 * @param {string|null|undefined} url
 * @returns {string|null} a fetchable URL, or null while it loads
 */
export function mediaSrc(url) {
  mediaVersionSignal.value;
  return resolveMedia(url, bumpMediaVersion);
}

function bumpMediaVersion() {
  mediaVersionSignal.value = mediaVersionSignal.value + 1;
}
