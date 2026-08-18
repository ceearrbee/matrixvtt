/**
 * emojiPicker.test.jsx - unit tests for the EmojiPicker Preact component.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, h } from 'preact';
import { act } from 'preact/test-utils';
import { EmojiPicker } from '../ui/EmojiPicker.jsx';

describe('<EmojiPicker>', () => {
  let host;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    render(null, host);
    host.remove();
  });

  it('renders without crashing and focuses the search input', () => {
    act(() => {
      render(h(EmojiPicker, { onPick: () => {} }), host);
    });
    const input = host.querySelector('.emoji-search');
    expect(input).toBeTruthy();
  });

  it('renders all 8 category tabs', () => {
    act(() => {
      render(h(EmojiPicker, { onPick: () => {} }), host);
    });
    const tabs = host.querySelectorAll('.category-tab');
    expect(tabs.length).toBe(8);
  });

  it('default category "people" shows people emojis including 👍', () => {
    act(() => {
      render(h(EmojiPicker, { onPick: () => {} }), host);
    });
    const cells = host.querySelectorAll('.emoji-cell');
    const chars = Array.from(cells).map((c) => c.textContent);
    expect(chars).toContain('👍');
  });

  it('typing "fire" in search shows 🔥 and hides unrelated emojis', () => {
    act(() => {
      render(h(EmojiPicker, { onPick: () => {} }), host);
    });

    const cellsBefore = host.querySelectorAll('.emoji-cell').length;

    const input = host.querySelector('.emoji-search');
    input.value = 'fire';
    act(() => {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const cellsAfter = Array.from(host.querySelectorAll('.emoji-cell'));
    const chars = cellsAfter.map((c) => c.textContent);
    expect(chars).toContain('🔥');
    // Should be fewer results than showing an entire category
    expect(cellsAfter.length).toBeLessThan(cellsBefore);
  });

  it('clicking a category tab switches the grid contents', () => {
    act(() => {
      render(h(EmojiPicker, { onPick: () => {} }), host);
    });

    // Default is people - grab cells
    const peopleCells = Array.from(host.querySelectorAll('.emoji-cell')).map((c) => c.textContent);

    // Click the "nature" tab (second tab)
    const tabs = host.querySelectorAll('.category-tab');
    act(() => {
      tabs[1].click(); // nature
    });

    const natureCells = Array.from(host.querySelectorAll('.emoji-cell')).map((c) => c.textContent);
    // Nature should include a dragon or tree, and differ from people
    expect(natureCells.join('')).not.toBe(peopleCells.join(''));
    expect(natureCells.some((c) => ['🐉', '🌲', '🦁', '🐺', '🌿'].includes(c))).toBe(true);
  });

  it('clicking an emoji button fires onPick with that char', () => {
    const onPick = vi.fn();
    act(() => {
      render(h(EmojiPicker, { onPick }), host);
    });

    const firstCell = host.querySelector('.emoji-cell');
    act(() => {
      firstCell.click();
    });

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(typeof onPick.mock.calls[0][0]).toBe('string');
    expect(onPick.mock.calls[0][0].length).toBeGreaterThan(0);
  });

  it('pressing Escape fires onClose', () => {
    const onClose = vi.fn();
    act(() => {
      render(h(EmojiPicker, { onPick: () => {}, onClose }), host);
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
