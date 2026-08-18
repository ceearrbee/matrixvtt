/**
 * Avatar primitive - circular portrait with monogram fallback.
 *
 * When `image_url` is set, render an <img> at the requested size.
 * Otherwise, render a colored circle with a 1–2 letter monogram derived
 * from `name`. Color falls back to a hash-derived hue if no explicit
 * `color` is provided.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup } from '@testing-library/preact';
import { Avatar } from '../ui/Avatar.jsx';

afterEach(() => { cleanup(); });

describe('Avatar', () => {
  it('renders an <img> when image_url is provided', () => {
    const { container } = render(h(Avatar, {
      imageUrl: 'https://example.com/portrait.png',
      name: 'Aria Blackwood',
    }));
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('https://example.com/portrait.png');
    expect(img.getAttribute('alt')).toBe('Aria Blackwood');
  });

  it('renders a monogram fallback when image_url is missing', () => {
    const { container } = render(h(Avatar, { name: 'Aria Blackwood' }));
    expect(container.querySelector('img')).toBeNull();
    const monogram = container.querySelector('.avatar__monogram');
    expect(monogram).not.toBeNull();
    expect(monogram.textContent).toBe('AB');
  });

  it('uses one letter when name is a single word', () => {
    const { container } = render(h(Avatar, { name: 'Sora' }));
    expect(container.querySelector('.avatar__monogram').textContent).toBe('S');
  });

  it('shows "?" monogram when name is missing', () => {
    const { container } = render(h(Avatar, {}));
    expect(container.querySelector('.avatar__monogram').textContent).toBe('?');
  });

  it('respects the size prop (md = 32px default)', () => {
    const { container } = render(h(Avatar, { name: 'Aria', size: 24 }));
    const el = container.querySelector('.avatar');
    expect(el.getAttribute('data-size')).toBe('24');
  });

  it('exposes the color when provided (used by the monogram background)', () => {
    const { container } = render(h(Avatar, { name: 'Aria', color: '#185FA5' }));
    const monogram = container.querySelector('.avatar__monogram');
    expect(monogram.getAttribute('style')).toContain('#185FA5');
  });
});
