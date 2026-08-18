/**
 * Card - shared clickable-card scaffold for the entity lists (items,
 * spells, characters/NPCs, maps).
 *
 * The card's primary action is a stretched inner <button>
 * (.card__hit) covering the card, while the per-row action buttons sit
 * above it - the accessible cards pattern. The old shape (role=button
 * on the wrapper with focusable children inside) was the
 * nested-interactive violation axe flags: a button must not contain
 * other focusable controls.
 */
import { h } from 'preact';

export function Card({
  class: className = '',
  onActivate = undefined,
  onDblActivate = undefined,
  ariaLabel = undefined,
  extraProps = {},
  children = null,
}) {
  const interactive = onActivate || onDblActivate;
  return h(
    'div',
    {
      class: `card${className ? ` ${className}` : ''}`,
      ...extraProps,
    },
    [
      interactive && h('button', {
        type: 'button',
        class: 'card__hit',
        'aria-label': ariaLabel,
        onClick: onActivate,
        onDblClick: onDblActivate,
      }),
      children,
    ],
  );
}
