/**
 * Card - the shared clickable-card scaffold used by item/spell/entity/map
 * lists. Encapsulates the role=button + tabindex + keyboard + click-bail
 * interaction so every list card behaves and is a11y-reachable identically.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';

import { Card } from '../ui/Card.jsx';

afterEach(() => cleanup());

describe('Card', () => {
  it('renders a real stretched button carrying the accessible name', () => {
    const { container } = render(
      h(Card, { class: 'item-card', ariaLabel: 'View Torch', onActivate: () => {} }, 'body')
    );
    const card = container.querySelector('.card');
    expect(card).not.toBeNull();
    expect(card.classList.contains('item-card')).toBe(true);
    // The wrapper must NOT be an interactive role: a button with
    // focusable children is the nested-interactive violation.
    expect(card.getAttribute('role')).toBeNull();
    const hit = card.querySelector('.card__hit');
    expect(hit.tagName).toBe('BUTTON');
    expect(hit.getAttribute('aria-label')).toBe('View Torch');
  });

  it('activates via the hit button; inner buttons stay independent', () => {
    const onActivate = vi.fn();
    const inner = vi.fn();
    const { container } = render(
      h(Card, { class: 'x', onActivate }, h('button', { type: 'button', onClick: inner }, 'Edit'))
    );
    fireEvent.click(container.querySelector('.card__hit'));
    expect(onActivate).toHaveBeenCalledTimes(1);
    fireEvent.click(container.querySelector('button:not(.card__hit)'));
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('wires an optional double-click handler and passes through extra attributes', () => {
    const onDblActivate = vi.fn();
    const { container } = render(
      h(Card, { onDblActivate, extraProps: { 'data-map-id': 'm1' } }, 'body')
    );
    const card = container.querySelector('.card');
    expect(card.getAttribute('data-map-id')).toBe('m1');
    fireEvent.dblClick(card.querySelector('.card__hit'));
    expect(onDblActivate).toHaveBeenCalledTimes(1);
  });
});
