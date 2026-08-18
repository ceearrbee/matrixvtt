/**
 * renderMarkdown - Markdown → HTML for handout / item / character notes.
 *
 * Backed by `marked` (GFM-flavoured CommonMark). Replaces an 82-line
 * hand-rolled subset with the full spec: links, blockquotes, code,
 * GFM tables, etc. work without us extending the parser every time
 * a user expects another Markdown construct.
 *
 * DOMPurify sanitizes the generated HTML. This keeps Markdown features
 * such as links and tables while making the HTML-rendering boundary
 * explicit and library-backed instead of relying on bespoke escaping.
 */

import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({ breaks: false, gfm: true, pedantic: false });

/**
 * Convert a Markdown string to an HTML string. Returns empty string
 * for nullish / empty input - preserves the call sites that
 * unconditionally pass `character.notes` etc.
 *
 * @param {string|null|undefined} text
 * @returns {string}
 */
export function renderMarkdown(text) {
  if (!text) return '';
  const html = marked.parse(_escapeHtml(String(text)), { async: false });
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

function _escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
