/**
 * user-storage.js - per-user namespaced localStorage with a one-shot
 * legacy migration.
 *
 * Globally namespaced keys leak dice macros and tutorial-completion
 * state between users sharing a browser.
 * Scoped keys take the form `${base}::${userId}`. On first read for a
 * given user, any pre-existing unscoped value is migrated into that
 * user's scope and the legacy key is removed - so subsequent users on
 * the same browser start clean.
 *
 * When userId is null/empty (e.g. before login), reads fall through to
 * the legacy unscoped key without migrating. Writes with no userId
 * are a no-op to avoid silently dropping data into the global slot.
 */

function scopedKey(base, userId) {
  return `${base}::${userId}`;
}

export function readUserScoped(base, userId) {
  if (!userId) return localStorage.getItem(base);
  const scoped = scopedKey(base, userId);
  const direct = localStorage.getItem(scoped);
  if (direct !== null) return direct;
  const legacy = localStorage.getItem(base);
  if (legacy !== null) {
    localStorage.setItem(scoped, legacy);
    localStorage.removeItem(base);
    return legacy;
  }
  return null;
}

export function writeUserScoped(base, userId, value) {
  if (!userId) return;
  localStorage.setItem(scopedKey(base, userId), value);
}

export function removeUserScoped(base, userId) {
  if (userId) localStorage.removeItem(scopedKey(base, userId));
  localStorage.removeItem(base);
}
