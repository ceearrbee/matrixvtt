/**
 * ComposerChip - pill button primitive used across the chat-shell composer.
 *
 * Used by:
 *   - active-character chip
 *   - target chip (Use… menu)
 *   - OOC tab (with unread badge)
 *   - header tool-cluster buttons
 *
 * Visual + ergonomic model from rpglog (Prose Pals): pill radius, soft
 * outline, optional leading icon, optional trailing badge for unread
 * counters, aria-pressed for toggle states.
 */

import { h } from 'preact';

/**
 * @param {{
 *   label: string,
 *   name?: string,
 *   onClick?: (e: any) => void,
 *   icon?: any,
 *   badge?: number,
 *   selected?: boolean,
 *   disabled?: boolean,
 *   variant?: 'default' | 'danger' | 'primary',
 *   title?: string,
 *   'aria-label'?: string,
 * }} props
 */
export function ComposerChip(props) {
  const {
    label, name, onClick, icon, badge,
    selected, disabled, variant = 'default',
    title,
  } = props;
  const ariaLabel = props['aria-label'];
  const hasBadge = typeof badge === 'number' && badge > 0;
  return h('button', {
    type: 'button',
    class: 'composer-chip',
    'data-composer-chip': name || '',
    'data-variant': variant,
    'aria-pressed': selected === undefined ? null : (selected ? 'true' : 'false'),
    'aria-label': ariaLabel || null,
    title: title || null,
    disabled: disabled || null,
    onClick,
  }, [
    icon ? h('span', { key: 'i', class: 'composer-chip__icon', 'aria-hidden': 'true' }, icon) : null,
    h('span', { key: 'l', class: 'composer-chip__label' }, label),
    hasBadge
      ? h('span', { key: 'b', class: 'composer-chip__badge', 'data-chip-badge': '' }, String(badge))
      : null,
  ]);
}
