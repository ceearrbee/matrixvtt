/**
 * Shared helpers for the generic narrative-section primitives
 * (`tagged_list`, `button_action`, …). Pure template substitution
 * plus a thin dispatch to the existing chat-integrator announce
 * path, with a window-event fallback for tests / contexts where
 * the integrator isn't wired (e.g. an editor-only render).
 */

const PLACEHOLDER_RE = /\{(\w+)\}/g;

/**
 * Replace `{name}` placeholders in `template` from `vars`. Single pass -
 * if a substituted value itself contains a `{name}` token, it is NOT
 * re-substituted (prevents user content from hijacking template slots).
 * Unknown placeholders pass through literally.
 *
 * @param {string} template
 * @param {Record<string, unknown> | null | undefined} vars
 * @returns {string}
 */
export function substituteTemplate(template, vars) {
  if (vars == null) return String(template);
  return String(template).replace(PLACEHOLDER_RE, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) return match;
    return String(vars[key]);
  });
}

/**
 * Surface an announcement string in the chat log. Prefers
 * `ui.chat.announceMessage` (the existing chat-integrator path -
 * `src/chat/announcements.js#announceMessage`) so the live region and
 * room timeline both pick it up the same way damage / heal / combat
 * announcements do. Falls back to a `vtt:announce` window event when
 * chat isn't wired, so test contexts can spy on it.
 *
 * @param {{ chat?: { announceMessage?: (msg: string) => Promise<void> | void } }} ui
 * @param {string} message
 */
export async function dispatchAnnounce(ui, message) {
  const announce = ui?.chat?.announceMessage;
  if (typeof announce === 'function') {
    return announce.call(ui.chat, message);
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('vtt:announce', { detail: { message } }));
  }
}
