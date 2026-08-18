/**
 * SheetHeader - shared header for the PC and NPC sheets.
 *
 * Hand-rolled per-sheet headers diverge (a styled .entity-header vs an
 * unstyled .sheet-header* structure with a different button size and
 * no avatar fallback). This unifies both onto .entity-header so they
 * read identically; each sheet still supplies its own action buttons
 * via `actions`.
 */
import { h } from 'preact';

export function SheetHeader({
  variant,
  name,
  subtitle = null,
  imageUrl = null,
  onBack = null,
  actions = null,
}) {
  const avatar = imageUrl
    ? h(
        'div',
        { class: `entity-avatar entity-avatar--${variant} entity-avatar--image` },
        h('img', { src: imageUrl, alt: '', loading: 'lazy' })
      )
    : h('div', { class: `entity-avatar entity-avatar--${variant}` }, (name || '').substring(0, 2));

  return h('div', { class: 'entity-header' }, [
    h('div', { class: 'entity-header__identity' }, [
      onBack &&
        h(
          'button',
          {
            class: 'dbt dbt--sm',
            title: 'Back to list',
            'aria-label': 'Back to list',
            onClick: onBack,
          },
          '←'
        ),
      avatar,
      h('div', { class: 'entity-meta' }, [
        h('div', { class: 'entity-name' }, name),
        subtitle && h('div', { class: 'entity-subtitle' }, subtitle),
      ]),
    ]),
    actions && h('div', { class: 'sheet-header__actions' }, actions),
  ]);
}
