/**
 * EmptyState - a shared empty-state surface. Three render shapes
 * (all backward-compatible):
 *
 *   1. Legacy `message` - one paragraph.
 *   2. Editorial triplet - `eyebrow` + `heading` + `body`.
 *   3. Notion-pattern hero - `glyph` + `title` + `body` + optional
 *      primary `cta` + optional `secondary` button (Track 2 of the
 *      research-grounded polish pass).
 *
 * All shapes share the same outer `[role="status"]` wrapper so
 * screen-readers announce the empty surface consistently.
 *
 * @param {object} props
 * @param {string} [props.message]   Legacy single-paragraph form.
 * @param {string} [props.eyebrow]   Small uppercase tracked label.
 * @param {string} [props.heading]   Work Sans heading.
 * @param {string} [props.title]     Notion-pattern alias of `heading`.
 * @param {string} [props.body]      Source Serif body copy.
 * @param {string} [props.glyph]     Single-character icon shown above title.
 * @param {{ label: string, onClick: () => void }} [props.cta]
 * @param {{ label: string, onClick: () => void }} [props.secondary]
 */
import { h } from 'preact';

export function EmptyState({
  message = '', eyebrow = '', heading = '', title = '', body = '',
  glyph = '', cta = null, secondary = null,
}) {
  const headingText = heading || title;
  const editorial = !!(eyebrow || headingText || body || glyph);
  return h('div', { class: 'empty-state', role: 'status' }, [
    glyph && h('div', { class: 'empty-state__glyph', 'aria-hidden': 'true' }, glyph),
    editorial
      ? h('div', { class: 'empty-state__editorial' }, [
          eyebrow && h('span', { class: 'eyebrow' }, eyebrow),
          headingText && h('h3', { class: 'editorial-heading empty-state__title' }, headingText),
          body && h('p', { class: 'editorial-body' }, body),
        ])
      : h('p', { class: 'empty-state__msg' }, message),
    cta && h(
      'button',
      {
        type: 'button',
        class: 'dbt btn-primary empty-state__cta',
        onClick: cta.onClick,
      },
      cta.label,
    ),
    secondary && h(
      'button',
      {
        type: 'button',
        class: 'dbt dbt--sm empty-state__secondary',
        onClick: secondary.onClick,
      },
      secondary.label,
    ),
  ]);
}
