/**
 * SheetHeader - the one shared PC/NPC sheet header. Hand-rolled
 * per-sheet header markup diverges (.entity-header vs undefined
 * .sheet-header*); this unifies structure, avatar fallback, and actions.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';

import { SheetHeader } from '../ui/SheetHeader.jsx';

afterEach(() => cleanup());

describe('SheetHeader', () => {
  it('renders a shared .entity-header with a variant avatar, name, and subtitle', () => {
    const { container } = render(
      h(SheetHeader, { variant: 'npc', name: 'Goblin Scout', subtitle: 'CR 1/4 · Small' })
    );
    expect(container.querySelector('.entity-header')).not.toBeNull();
    expect(container.querySelector('.entity-avatar--npc')).not.toBeNull();
    expect(container.querySelector('.entity-name').textContent).toContain('Goblin Scout');
    expect(container.querySelector('.entity-subtitle').textContent).toBe('CR 1/4 · Small');
  });

  it('falls back to initials when there is no image, and uses the image otherwise', () => {
    const { container: initials } = render(h(SheetHeader, { variant: 'pc', name: 'Aria' }));
    const avatar = initials.querySelector('.entity-avatar--pc');
    expect(avatar.querySelector('img')).toBeNull();
    expect(avatar.textContent).toBe('Ar');

    const { container: withImg } = render(
      h(SheetHeader, { variant: 'pc', name: 'Aria', imageUrl: 'mxc://s/abc' })
    );
    expect(withImg.querySelector('.entity-avatar--image img')).not.toBeNull();
  });

  it('renders an optional back button and the actions slot', () => {
    const onBack = vi.fn();
    const { container } = render(
      h(SheetHeader, {
        variant: 'npc', name: 'Goblin', onBack,
        actions: h('button', { type: 'button', 'aria-label': 'Edit NPC' }, 'edit'),
      })
    );
    const back = container.querySelector('[aria-label="Back to list"]');
    expect(back).not.toBeNull();
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.sheet-header__actions [aria-label="Edit NPC"]')).not.toBeNull();
  });

  it('omits the back button when no onBack is given', () => {
    const { container } = render(h(SheetHeader, { variant: 'pc', name: 'Aria' }));
    expect(container.querySelector('[aria-label="Back to list"]')).toBeNull();
  });
});
