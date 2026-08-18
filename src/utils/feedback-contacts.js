/**
 * feedback-contacts.js - the beta feedback destinations, build-time
 * configurable so they aren't baked into every rebuild. Kept dependency-free
 * (no Preact/modal imports) so the pre-login AuthScreen can use them too.
 */

export const FEEDBACK_MATRIX = import.meta.env?.VITE_FEEDBACK_MATRIX || '@crb:mozilla.org';
export const FEEDBACK_MASTODON = import.meta.env?.VITE_FEEDBACK_MASTODON || '@crb@social.nondescript.design';

export const matrixUrl = (id = FEEDBACK_MATRIX) => `https://matrix.to/#/${id}`;
export const mastodonUrl = (handle = FEEDBACK_MASTODON) => {
  const m = /^@?([^@]+)@(.+)$/.exec(handle);
  return m ? `https://${m[2]}/@${m[1]}` : handle;
};
