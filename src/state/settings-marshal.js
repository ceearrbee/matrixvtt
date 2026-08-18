/**
 * settings-marshal.js - strip half of the SETTINGS write/read symmetry.
 *
 * `systemConfig` is the resolved ruleset preset (potentially tens of KB,
 * a function of `settings.system` + optional inline overrides). On
 * outbound writes we strip it so the state event stays well under the
 * 63 KB matrix.org cap; on read, `applySettings` in `syncer-apply.js`
 * re-derives it from the slug. This module is the documented strip
 * half - its inverse is `applySettings`.
 */

/**
 * @param {object | null | undefined} content
 * @returns {object | null | undefined}
 */
export function stripSystemConfigForWrite(content) {
  if (content == null) return content;
  const { systemConfig: _unused, ...rest } = /** @type {Record<string, unknown>} */ (content);
  return rest;
}
